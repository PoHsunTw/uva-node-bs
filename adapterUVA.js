const fs = require('fs');
const path = require('path');

const async = require('async');
const jsdom = require("jsdom");

const util = require('./util');
const RequestClient = require('./requestClient');
const Adapter = require('./adapter');

const UVA_HOST = "uva.onlinejudge.org";
const SUBMIT_PAGE_PATH = "/index.php?option=com_onlinejudge&Itemid=25";
const SUBMIT_PATH = "/index.php?option=com_onlinejudge&Itemid=25&page=save_submission";
const PROBLEM_PATH = "/index.php?option=com_onlinejudge&Itemid=8&category=24&page=show_problem&problem=";

const UHUNT_HOST = 'uhunt.felix-halim.net';

module.exports = (function(parentCls){
    // constructor
    function cls(app, acct)
    {
        // super constructor call
        parentCls.call(this, app, acct);

        // private instance fields
        var acctData = acct.getAdapterData();
        var adapData = app.getAdapterData('uva');
        var uvaClient = new RequestClient('https', UVA_HOST);
        var uhuntClient = new RequestClient('http', UHUNT_HOST);

        // private instance method
        function fetchUserId(callback)
        {
            if (acctData.userId > 0)
                return callback(null, acctData.userId);

            uhuntClient.get('/api/uname2uid/' + acct.user(), function(err, res, data){
                if (err)
                    return callback(err);
                acctData.userId = parseInt(data);
                callback(null, acctData.userId);
            });
        };

        function fetchProbs(callback)
        {
            if (adapData.probs && adapData.mapNum){
                return callback(null, adapData.probs);
            }

            uhuntClient.get('/api/p', function(err, res, data){
                if (err)
                    return callback(err);
                var p;
                try
                {
                    p = JSON.parse(data);
                }
                catch (e)
                {
                    return callback(e);
                }

                var map    = {}; // maps prob ID to array index
                var mapNum = {}; // maps prob # to array index
                for (var i=0;i < p.length; i++)
                {
                    var cur = p[i];
                    map   [cur[0].toString()] = i; // prob ID
                    mapNum[cur[1].toString()] = i; // prob #
                }

                adapData.map    = map;
                adapData.mapNum = mapNum;
                callback(null, adapData.probs = p);
            });
        }

        // public instance method
        this.login = function(callback){
            async.waterfall([
                function(subCallback){
                    uvaClient.get('/', subCallback);
                },
                function(res, html, subCallback){
                    if ((html || '').indexOf("Logout") >= 0){
                        var e = new Error();
                        e._uvaLogin = true;
                        return subCallback(e);
                    }

                    jsdom.env(html, [], subCallback);
                },
                function (window, subCallback) {
                    const document = window.document;
                    var f = cls.parseForm(document);

                    var err = null;
                    if (!f)
                        err = ("cannot find HTML form");
                    else if (!f.userField)
                        err = ("cannot find user field");
                    else if (!f.passField)
                        err = ("cannot find pass field");
                    else if (!f.action)
                        err = ("cannot find action");

                    if (err)
                        return subCallback(new Error(err));

                    f.data[f.userField] = acct.user();
                    f.data[f.passField] = acct.pass();
                    var opts = {
                        // Must not follow otherwise will miss the session cookie.
                        followAllRedirects: false,
                        headers: {
                            Referer: 'https://' + UVA_HOST,
                        },
                    };
                    uvaClient.post(f.action, f.data, opts, subCallback);
                },
            ],
            function(err, res, html){
                if (err && !err._uvaLogin){
                    return callback(err);
                }
                callback();
            });
        };

        /**
         * Finds existing source code files which names contain the
         * problem number.
         * @return array of file names which fit the criteria; empty if not found.
         */
        this.findFileNames = function(probNum){
            var found = [];
            var all = fs.readdirSync('.');
            var probNumStr = probNum+'';

            for (var i=0;i < all.length; i++)
            {
                var cur = all[i];
                var ext = util.getFileExt(cur).toLowerCase();
                var lang = util.getLang(ext);

                if (lang >= 0)
                {
                    var m = cur.match(/0*(\d+)/);
                    if (m && m[1] == probNumStr)
                        found.push(cur);
                }
            }

            return found;
        };

        /**
         * Infers the prob num from a file path
         * @return undefined if not found; else the problem num as a string.
         */
        this.inferProbNum = function(filePath){
            var fileName = path.basename(filePath);
            var m = fileName.match(/0*(\d+)/);
            if (m) return m[1];
        };

        this._send = function(probNum, filePath, fileExt, callback){
            var langVal = cls.getLangVal(util.getLang(fileExt.toLowerCase()));
            if (langVal < 0)
                return callback(new Error('unacceptable programming lang'));

            var data = {
                localid: probNum,
                code: '',
                language: langVal,
                codeupl: fs.createReadStream(filePath),
                problemid: '',
                category: '',
            };
            var opts = {
                headers: {
                    Referer: 'https://' + UVA_HOST + SUBMIT_PATH,
                },
            };
            uvaClient.postMultipart(SUBMIT_PATH, data, opts, function(err, res, html){
                if (err)
                    return callback(err);
                if (html.match(/not\s+authori[zs]ed/i))
                    return callback(new Error('cannot login. password correct?'));
                callback(null);
            });
        };

        this.fetchStatus = function(num, callback){
            var tries = 0;
            function process(buf)
            {
                var obj;
                try
                {
                    obj = JSON.parse(buf);
                }
                catch(e)
                {
                    return callback(e);
                }
                var subs = obj.subs;

                // latest at 0th elem.
                subs.sort(function(a,b){return b[0] - a[0];});

                // must sort first then slice
                if (subs.length > num)
                    subs = subs.slice(0, num);
                /*
                subs[i] is an array with fields in this order:
                0: Submission ID
                1: Problem ID
                2: Verdict ID
                3: Runtime
                4: Submission Time (unix timestamp)
                5: Language ID (1=ANSI C, 2=Java, 3=C++, 4=Pascal)
                6: Submission Rank
                */

                var p = adapData.probs;
                var map = adapData.map;
                var outdated = false;
                for (var i=0;i < subs.length; i++)
                {
                    var cur = subs[i];
                    var idx = map[cur[1].toString()];
                    if (p[idx])
                        cur[1] = p[idx][1];
                    else
                    {
                        cur[1] = -1;
                        outdated = true;
                        // don't break
                    }

                    cur[2] = cls.getVerdict(cur[2]);
                    cur[4] *= 1000; // convert to millisec
                    cur[5] = cls.getLang(cur[5]);
                }

                if (outdated && tries++ < 1)
                {
                    // retry
                    adapData.probs = null;
                    return fetchProbs(function(e){
                        if (e) return callback(e);
                        process(buf);
                    });
                }

                callback(null, subs);
            }

            async.waterfall([
                fetchProbs,
                function(probs, subCallback){
                    fetchUserId(subCallback);
                },
                function(userId, subCallback){
                    uhuntClient.get('/api/subs-user/' + userId, subCallback);
                },
            ],
            function(err, res, data){
                if (err)
                    return callback(err);
                process(data);
            });
        };

        this.getProblemURL = function(probNum, callback){
            fetchProbs(function(err, probs){
                if (err) {
                    return callback(err);
                }

                var theProb = probs[adapData.mapNum[probNum+'']];
                if (theProb)
                {
                    var probId = theProb[0];
                    callback(null, 'http://'+UVA_HOST+PROBLEM_PATH + probId);
                    return;
                }

                callback(null,null);
            });
        };
    }

    cls.parseForm = function(document){
        const form = document.getElementById("mod_loginform");
        if (! form) {
            return null;
        }

        var r = {
            action: form.action,
            data: {},
        };

        for (var i = 0; i < form.elements.length; i++){
            var input = form.elements[i];
            var name = input.name;
            var nameLower = name.toLowerCase();
            var type = input.type.toLowerCase();
            var isText = type === 'text' || type === 'password';

            if (isText && nameLower.indexOf("user") >= 0){
                r.userField = name;
            }
            else if (isText && nameLower.indexOf("pass") >= 0){
                r.passField = name;
            }
            else if (name && !r.data.hasOwnProperty(name)){
                r.data[name] = input.value;
            }
        }

        return r;
    };

    /**
     * @param lang One of LANG_* constants
     * @return UVA lang value or -1 if unacceptable.
     */
    cls.getLangVal = function(lang){
        switch (lang)
        {
        case util.LANG_C: return 1;
        case util.LANG_JAVA: return 2;
        case util.LANG_CPP: return 3;
        case util.LANG_PASCAL: return 4;
        case util.LANG_CPP11: return 5;
        case util.LANG_PYTHON: return 6;
        }

        return -1;
    };

    cls.getVerdict = function(ver)
    {
        switch(ver)
        {
        case 10: return Adapter.STATUS_ERROR;
        case 15: return Adapter.STATUS_QUEUE_ERROR;
        case 20: return Adapter.STATUS_IN_QUEUE;
        case 30: return Adapter.STATUS_COMPILE_ERROR;
        case 35: return Adapter.STATUS_RESTRICTED_FN;
        case 40: return Adapter.STATUS_RUNTIME_ERROR;
        case 45: return Adapter.STATUS_OUTPUT_LIMIT;
        case 50: return Adapter.STATUS_TIME_LIMIT;
        case 60: return Adapter.STATUS_MEM_LIMIT;
        case 70: return Adapter.STATUS_WRONG_ANS;
        case 80: return Adapter.STATUS_PRESENTATION;
        case 90: return Adapter.STATUS_ACCEPTED;
        }

        return Adapter.STATUS_UNKNOWN;
    };

    cls.getLang = function(id)
    {
        switch(id)
        {
        case 1: return "C";
        case 2: return "Java";
        case 3: return "C++";
        case 4: return "Pascal";
        case 5: return "C++11";
        case 6: return "Python";
        }

        return "?";
    };

    return cls;
})(Adapter);
