const colors = require('colors');
const fs = require('fs');
const path = require('path');
const util = require('./util');

// Maps from typeName to class function
var subClasses = {}; // private static field
var normNames = {}; // normalize the type name

module.exports = (function(){
    // constructor
    function cls(app, acct)
    {
        // public instance method
        this.send = function(probNum, filePath, callback){
            // suf includes the dot
            var suf = path.extname(filePath);
            if (suf.length <= 1)
            {
                callback({message: "Cannot auto-detect language"});
                return;
            }

            suf = suf.substring(1).toLowerCase();
            this._send(probNum, filePath, suf, callback);
        };

        this.account  = function(){
            return acct;
        };
    }

    cls.normalizeType = function(s){
        return normNames[s.toLowerCase()];
    };

    // public static method
    cls.create = function(app, acct){
        var clsFn = subClasses[acct.type().toLowerCase()];
        if (clsFn) return new clsFn(app, acct);
        return null;
    };

    const STATUSES = {
        STATUS_ERROR         : {label: "subm err",      color: "red"},
        STATUS_QUEUE_ERROR   : {label: "can't queue",   color: "red"},
        STATUS_IN_QUEUE      : {label: "in queue",      color: "yellow"},
        STATUS_COMPILE_ERROR : {label: "compile err",   color: "yellow"},
        STATUS_RESTRICTED_FN : {label: "restricted func",   color: "yellow"},
        STATUS_RUNTIME_ERROR : {label: "runtime err",   color: "cyan"},
        STATUS_OUTPUT_LIMIT  : {label: "output limit",  color: "yellow"},
        STATUS_TIME_LIMIT    : {label: "time limit",    color: "blue"},
        STATUS_MEM_LIMIT     : {label: "mem limit",     color: "yellow"},
        STATUS_WRONG_ANS     : {label: "wrong ans",     color: "red"},
        STATUS_PRESENTATION  : {label: "presentation",  color: "yellow"},
        STATUS_ACCEPTED      : {label: "accepted",      color: "green"},
        STATUS_UNKNOWN       : {label: "?",             color: "white"},
    };

    for (var key in STATUSES)
    {
        var status = STATUSES[key];
        status.coloredLabel = status.label[status.color];
        cls[key] = status;
    }

    return cls;
})();

/*
 * Auto load the subclasses
 */
(function(){
    var files = fs.readdirSync(__dirname);
    for (var i=0; i < files.length; i++)
    {
        var match = /^adapter(\w+)/i.exec(files[i]);
        if (!match) continue;
        var modName = match[1];
        var lower = modName.toLowerCase();
        normNames[lower] = modName;
        subClasses[lower] = require('./'+files[i]);
    }
})();
