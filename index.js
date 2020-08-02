#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const sprintf = require('sprintf').sprintf;
const util = require('./util');
const Account = require('./account');
const Adapter = require('./adapter');
const App = require('./app');
const xlsx2json = require("node-xlsx");
const request   = require('request');

const SETTING_FILE_NAME = ".uva-node";
const SETTING_PATH = path.join(util.getUserHomePath(), SETTING_FILE_NAME);
//my area=============================================================
const downloadDir = './code';
const wrongDir = "./code/wrong";
const responseFilePath = "./file/re.xlsx";
const outcomeFilePath = "./result.xlsx";

const debug = false;
var fileUrl = [];
var ID = [];
var ID2UVA = [];
var fileNames = [];
var code_amount = [0,0];
var filePath = [];
var num = 10;
var outcome_full = [['SubmittionID', '檔名', '學號', 'UVA_ID', '狀態']];
var outcome2_full = [['學號', 'UVA_ID', '狀態']];


var list = xlsx2json.parse(responseFilePath);
var data = [...(list[0].data)];

function Download_File(fileUrl){
    return new Promise((resolve, reject) => {
        var r = request(fileUrl).on('response', function(res) {
            var filename, contentDisp = res.headers['content-disposition'];
            if (contentDisp && /^attachment/i.test(contentDisp)) {
                filename = contentDisp.toLowerCase()
                    .split('filename=')[1]
                    .split(';')[0]
                    .replace(/"/g, '');
            } else {
                filename = path.basename(url.parse(fileUrl).path);
                console.log('@@@else@@@');
            }
            //console.log('FN:'+filename);
            r.pipe(fs.createWriteStream(path.join(__dirname, downloadDir, filename)));
            fileInfo = filename.split('-');
            var fileInfo_id = fileInfo[0].replace(/ /gi,'');
            var fileInfo_uva = fileInfo[1].replace(/uva/gi,'').replace(/ /gi,'');
            if(isNaN(fileInfo_id)||isNaN(fileInfo_uva)){
                //file format wrong!!
                console.log('id:'+fileInfo_id+' UVA:'+fileInfo_uva+' format is wrong!');
                code_amount[1]++;
                fs.rename(path.join(__dirname, downloadDir, filename), path.join(__dirname, wrongDir, filename), (err) => {
                    if (err) throw err;
                });
            }else{
                filePath.push(path.join(downloadDir, filename));
                //file format wrong!!
                ID.push(fileInfo_id);
                ID2UVA.push(fileInfo_uva);
                fileNames.push(filename);
                if(debug) console.log('id:'+fileInfo_id+' UVA:'+fileInfo_uva);
                code_amount[0]++;
            }
            resolve();
        });
    });
}
function LockIfPendding(){
    var curAdap = getCurrentAdapter();
    if (!curAdap) return;

    if(debug) console.log('Getting status...');
    return new Promise((resolve, reject) => {
        curAdap.fetchStatus(num, function(e, subs){
            if (e)
                console.log('Status error: '+e.message);
            else
                var uvaStatus = [];
                var sub = subs[0];
                var subId = sub[0];
                var probId = sub[1];
                var verdict = sub[2];
                uvaStatus[0] = subId;
                uvaStatus[1] = probId;
                uvaStatus[2] = verdict['label'].toLowerCase();
                if(debug) console.log('LockIfPendding end');
                resolve(uvaStatus);
        });
    });
}
function sendSubmittion(curAdap,proNum,filePath,ID){
    return new Promise((resolve, reject) => {
        curAdap.send(proNum, filePath, function(e){
            if (e){
                if(debug) console.log(ID+':'+proNum+'  send failed: '+e.message);
                reject(Error(ID+':'+proNum+'  send failed: '+e.message));
            }else{
                if(debug) console.log(ID+':'+proNum+'  Send ok');
                resolve(ID+':'+proNum+'  Send ok');
            }
        });
    });
}
async function sendAndLock(proNum,filePath,ID){
    var curAdap = getCurrentAdapter();
    if (!curAdap) return;
    try
    {
        console.log('Logging in...');
        curAdap.login(async function(e){
            if (e)
            {
                console.log('Login error: '+e.message);
                doneFn();
                return;
            }

            console.log('Sending code...');
            for(let i=0;i<proNum.length;++i){//filePath.length
                try{
                    if(debug) console.log(filePath[i]+":"+proNum[i]+":"+ID[i]);
                    var message = await sendSubmittion(curAdap,proNum[i],filePath[i],ID[i]);
                    console.log(message);
                }
                catch{
                    console.log('Send error: '+message);
                }
                var pendding = 1;
                while(pendding){
                    var uvaStatus = await LockIfPendding();
                    if(debug) console.log(uvaStatus[0]+":"+ID[i]+"-"+uvaStatus[1]+":"+uvaStatus[2]);
                    if(uvaStatus[2] !='?')
                        pendding = 0;
                }
                fs.unlink(filePath[i], (err) => {
                  if (err) {
                    console.error(err)
                    return
                  }
                  filePath[i];
                  //file removed
                })
                console.log(uvaStatus[0]+":"+ID[i]+"-"+uvaStatus[1]+":"+uvaStatus[2]);
                outcome_full.push([uvaStatus[0], fileNames[i], ID[i], uvaStatus[1], uvaStatus[2]]);
                if(uvaStatus[2]=='accepted')
                    outcome2_full.push([ID[i],uvaStatus[1],uvaStatus[2]]);
            }
            if(debug) console.log(outcome_full);
            var buffer = xlsx2json.build([{name: "all_submissions", data: outcome_full},{name: "accepted_submissions", data: outcome2_full}]);
            fs.writeFileSync(outcomeFilePath, buffer);
            console.log('=====輸出結果=====');
        });

        return;
    }
    catch (e)
    {
        console.log('Send error: '+e.message);
    }
}
function folderCheck(dirPath){
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
}
async function dataPreprocessing(data) {
    folderCheck(downloadDir);
    folderCheck(wrongDir);
    for (let i = 1 ; i < data.length; i++) {
        var datas = data[i][2].split(' ');
        var urls = data[i][3].split(', ');
        for (let j = 0;j<urls.length;j++){
            dwnUrls = urls[j].split('=');
            dwnUrlId = dwnUrls[dwnUrls.length-1];
            dwnUrl = 'https://drive.google.com/uc?export=download&id='+dwnUrlId;
            fileUrl.push(dwnUrl);
        }
    }
    console.log('=====File Downloading=====');
    for(let i = 0; i < fileUrl.length; ++i){
        await Download_File(fileUrl[i]);
    }
    if(code_amount[1])console.log('all format wrong file move to:'+path.join(__dirname, wrongDir));
    console.log('=====Total File(s):'+code_amount[0]+' wrong format:'+code_amount[1]+'=====');
    sendAndLock(ID2UVA,filePath,ID);
}
//============================================================================

var app = new App();

if (fs.existsSync(SETTING_PATH))
{
    app.load(SETTING_PATH);
}
else
{
    console.log('Setting file not found: %s', SETTING_PATH);
    console.log('A new one will be auto-created after exiting the program');
}

process.on('exit', saveSetting);

var args = process.argv.splice(2);
var interactive = args.length === 0;

if (! interactive)
{
    executeLine(args.join(' '), function(){
        process.exit(0);
    });
    return;
}

var rl = readline.createInterface(process.stdin, process.stdout);

rl.on('line', function(line){
    executeLine(line, function (quitting){
        if (quitting)
        {
            rl.close();
            return;
        }

        console.log();
        rl.prompt();
    });
})
.on('close', function() {
    console.log('Have a great day!');
    process.exit(0);
});
rl.setPrompt('> ');
rl.prompt();

function saveSetting()
{
    app.save(SETTING_PATH);
}

function printStatus(subs)
{
    console.log("Sub Id    | Prob # |      Verdict     |  Lang  | Runtime |  Rank |      Sub Time");
    //           123456789---123456---1234567890123456---123456---1234567---12345---yyyy-mm-dd hh:mm:ss

    var hasColors = process.stdout.isTTY;
    var formatStr = "%9d   %6d   %"+(hasColors ? 26 : 16)+"s   %6s   %3d.%03d   %5s   %4d-%02d-%02d %02d:%02d:%02d";
    var verdictKey = hasColors ? 'coloredLabel' : 'label';

    var date = new Date();
    for (var i = 0; i < subs.length;i++)
    {
        var sub = subs[i];
        var subId = sub[0];
        var probId = sub[1];
        var verdict = sub[2];
        var runtime = sub[3];
        var time = sub[4]; // in millisec
        var lang = sub[5];
        var rank = sub[6];

        date.setTime(time);
        console.log(sprintf(formatStr,
            subId, probId, verdict[verdictKey],
            lang, Math.floor(runtime/1000), runtime%1000,
            rank < 0 ? '-' : rank > 9999 ? '>9999' : rank,
            date.getFullYear(), date.getMonth()+1, date.getDate(),
            date.getHours(), date.getMinutes(), date.getSeconds()));
    }
}

function getCurrentAdapter()
{
    var curAdap = app.getCurrentAdapter();
    if (curAdap) return curAdap;

    console.log('No current account selected');
}

function executeLine(line, doneFn)
{
    var toks;
    try
    {
        toks = util.parseArgs(line);
    }
    catch (e)
    {
        util.logError(e);
        doneFn();
        return;
    }

    if (toks.length === 0)
        return doneFn();

    var action = toks[0].toLowerCase();

    function checkToks(argsCount, syntax)
    {
        if (toks.length !== argsCount+1)
        {
            console.log('Syntax: %s', syntax);
            return false;
        }

        return true;
    }

    function tplHandle(subAction)
    {
        switch(subAction)
        {
        case 'add':
            if (toks.length <= 2)
            {
                console.log('Syntax: tpl add <filePath>');
                break;
            }

            var ok = app.getTemplateManager().add(toks[2]);
            if (ok)
                console.log('Added or replaced existing template');
            else
                console.log('Cannot detect language');

            break;

        case 'remove':
            if (toks.length <= 2)
            {
                console.log('Syntax: tpl remove <lang>');
                break;
            }

            var lang = util.getLang(toks[2]);
            if (lang < 0)
            {
                console.log('Unknown language');
                break;
            }

            app.getTemplateManager().remove(lang);
            break;

        case 'show':
            console.log('lang     | file path');
            //           12345678---
            var tpls = app.getTemplateManager().getAll();
            for (var key in tpls)
            {
                var path = tpls[key];
                if (!path) continue;
                console.log(sprintf('%-8s   %s', util.getLangName(key), path));
            }
            break;

        default:
            console.log('unknown sub action');
        }
    }

    switch(action)
    {
    case 'exit':
    case 'quit':
        doneFn(true);
        return;

    case 'view':
        var curAdap = getCurrentAdapter();
        if (!curAdap) break;
        if (!checkToks(1, 'view <prob #>')) break;

        curAdap.getProblemURL(toks[1], function(e, url){
            if (e) {
                util.logError(e);
            }
            else if (url) {
                try {
                    app.openBrowser(url);
                }
                catch (e) {
                    util.logError(e);
                }
            }
            else {
                console.log('Problem not found');
            }

            doneFn();
        });

        return;

    case 'set-browser':
        if (toks.length < 2)
        {
            console.log('Syntax: set-browser <path> [<arg1> <arg2> ...]');
            break;
        }

        app.setBrowser(toks[1], toks.slice(2));
        console.log('Browser set');
        break;

    case 'get-browser':
        var opts = app.getBrowser();
        process.stdout.write('Command: '+opts.path+' <url>');

        for (var i=0;i<opts.args.length;i++)
        {
            process.stdout.write(' ');
            process.stdout.write(opts.args[i]);
        }
        console.log();
        break;

    case 'set-editor':
        if (!checkToks(1, 'set-editor <editor path>')) break;
        app.setEditor(toks[1]);
        console.log('Editor set');
        break;

    case 'edit':
        if (!checkToks(1, 'edit <file path>')) break;
        app.edit(toks[1], function(e){
            if (e)
                console.log('Cannot edit: '+e.message);
            else
                console.log('Edit done');
            doneFn();
        });
        return;

    case 'tpl':
        if (toks.length <= 1)
        {
            console.log('Syntax: tpl add <filePath> OR tpl remove <lang> OR tpl show');
            break;
        }

        var subAction = toks[1].toLowerCase();
        tplHandle(subAction);
        break;

    case 'send':
        var curAdap = getCurrentAdapter();
        if (!curAdap) break;

        var probNum, filePath;

        if (toks.length == 2)
        {
            console.log('2');
            var input = toks[1]; // can be prob# or filePath
            if (fs.existsSync(input))
            {
                probNum = curAdap.inferProbNum(input);
                filePath = input;
                if (!probNum)
                {
                    console.log('file "%s" exists, but cannot infer problem number.', input);
                    break;
                }
            }
            else
            {
                var files = curAdap.findFileNames(input);
                if (files.length == 0)
                {
                    console.log('Cannot find source files in current directory for problem: %s', input);
                    break;
                }

                if (files.length > 1)
                {
                    console.log('Multiple source files found: "%s", "%s", ...', files[0], files[1]);
                    break;
                }

                filePath = files[0];
                probNum = input;
            }

            console.log('Inferred Problem #: %s', probNum);
            console.log('       Source file: %s', filePath);
        }
        else if (toks.length == 3)
        {
            console.log('3');
            probNum = toks[1];
            filePath = toks[2];
        }
        else
        {
            console.log('else');
            checkToks(2, 'send <prob#> <fileName/Path>');
            break;
        }

        try
        {
            console.log('Logging in...');
            curAdap.login(function(e){
                if (e)
                {
                    console.log('Login error: '+e.message);
                    doneFn();
                    return;
                }

                console.log('Sending code...');
                curAdap.send(probNum, filePath, function(e){
                    if (e)
                        console.log('send failed: '+e.message);
                    else
                        console.log('Send ok');
                    doneFn();
                });
            });

            return;
        }
        catch (e)
        {
            console.log('Send error: '+e.message);
        }
        break;

    case 'use':
        if (toks.length === 3)
        {
            try {
                app.use(toks[1], toks[2]);
                console.log('Account set as current');
            }
            catch (e){
                util.logError(e);
            }
        }
        else if (toks.length === 1)
        {
            app.useNone();
            console.log('Current account set to none');
        }
        else
            checkToks(2, 'use <type> <userName> OR use');

        break;

    case 'add':
        // use traditional space-splitting in case password has quote chars.
        toks = line.trim().split(/\s+/g);
        if (! checkToks(3, 'add <type> <userName> <password>')) break;

        var normType = Adapter.normalizeType(toks[1]);
        if (!normType)
        {
            console.log('invalid type');
            break;
        }

        var acct = new Account({type: toks[1], user: toks[2], pass: toks[3]});
        var replaced = app.add(acct);
        if (replaced)
            console.log('An existing account was replaced');
        else
            console.log('Account added successfully');

        break;

    case 'remove':
        if (!checkToks(2, 'remove <type> <userName>')) break;

        try {
            app.remove(toks[1], toks[2]);
            console.log('Account removed');
        }
        catch(e) {
            util.logError(e);
        }

        break;

    case 'show':
        var size = app.size();

        if (!size)
        {
            console.log('No accounts');
            break;
        }

        console.log('      type     | user');
        //           12345678901234---1234

        for (var i=0;i < size; i++)
        {
            var acct = app.get(i);
            console.log(sprintf("%-14s   %s", acct.type(), acct.user()));
        }

        break;

    case 'stat':
    case 'status':
        var curAdap = getCurrentAdapter();
        if (!curAdap) break;

        var num = 10;
        if (toks.length == 2)
        {
            num = parseInt(toks[1]);
            if (num <= 0 || isNaN(num))
            {
                console.log('must be positive integer');
                break;
            }
        }
        else if (toks.length !== 1)
        {
            console.log('Syntax: stat/status <count>');
            break;
        }

        console.log('Getting status...');
        curAdap.fetchStatus(num, function(e, subs){
            if (e)
                console.log('Status error: '+e.message);
            else
                printStatus(subs);
            doneFn();
        });

        return;
    case 'bs':
    case 'batch-submit':
        dataPreprocessing(data);
        break;
    default:
        console.log('Unrecognized action123');
        break;
    }

    doneFn();
}
