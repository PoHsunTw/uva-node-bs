const http = require('http');
const qs = require('querystring');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const errors = require('./errors');

const LANG_C      = 1;
const LANG_JAVA   = 2;
const LANG_CPP    = 3;
const LANG_PASCAL = 4;
const LANG_CPP11  = 5;
const LANG_PYTHON = 6;

(function(obj){

obj.logError = function(e){
    console.error(e.stack || ('Error: ' + e));
};

obj.LANG_C = LANG_C;
obj.LANG_JAVA = LANG_JAVA;
obj.LANG_CPP = LANG_CPP;
obj.LANG_PASCAL = LANG_PASCAL;
obj.LANG_CPP11 = LANG_CPP11;
obj.LANG_PYTHON = LANG_PYTHON;

/**
 * @param fileExt Lowercase file extension without the dot.
 * @return LANG_* constant or -1 if unrecognized
 */
obj.getLang = function(fileExt){
    switch (fileExt)
    {
    case 'c': return LANG_C;
    case 'java': return LANG_JAVA;
    case 'cc':
    case 'cpp': 
    case 'cxx': return LANG_CPP11;
    case 'p':
    case 'pascal':
    case 'pas': return LANG_PASCAL;
    case 'py': return LANG_PYTHON;
    }

    return -1;
};

obj.getLangName = function(lang){
    lang = parseInt(lang);
    switch(lang)
    {
    case LANG_C: return 'C';
    case LANG_JAVA: return 'Java';
    case LANG_CPP: return 'C++';
    case LANG_PASCAL: return 'Pascal';
    case LANG_CPP11: return 'C++11';
    case LANG_PYTHON: return 'Python'
    }

    return '?';
};

/**
 * @return File extension without the dot; empty string if none.
 */
obj.getFileExt = function(filePath){
    var fileExt = path.extname(filePath);
    if (fileExt)
        return fileExt.substring(1);

    return '';
};

obj.createEndCallback = function(callback){
    var buf = '';
    return function(inMsg){
        inMsg.setEncoding('utf8');
        inMsg.on('readable', function(){buf += inMsg.read() || '';})
             .on('end', function(){callback(buf, inMsg);});
    };
};

/**
 * Removes surrounding quote chars (" or ') from a string.
 * Any whitespace surrounded by the quote chars are preserved but
 * whitespaces outside of the quote chars are removed. If no quote chars
 * are present the entire string is trimmed of whitespaces.
 * The string is processed adhering to the following rules:
 * - the starting and ending quote chars must be the same.
 * - if the starting or ending quote char is present, the other must also
 *    be present, that is, there must be no unmatched quote char.
 * <pre>
 * Examples:
 * String s = "  ' hello '  "; // unquote(s) returns "' hello '"
 * String s = "  'hello   ";   // unquote(s) will throw an exception
 * String s = " hello ";       // unquote(s) returns "hello"
 * </pre>
 * @param s
 * @exception if at least one
 * of the rules is violated.
 */
obj.unquote = function(s){
    s = s.trim();
    if (s.length >= 1)
    {
        var start = s.charAt(0);
        var end = s.length >= 2 ? s.charAt(s.length-1) : 0;
        var isQuote =
           (start === '"' || start === '\'' ||
            end   === '"' || end   === '\'');

        if (isQuote)
        {
            if (start === end)
                return s.substring(1, s.length-1);

            throw {message: "mismatched quote chars"};
        }
    }

    return s;
};

obj.getUserHomePath = function () {
    var p = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
    if (p) return p;
    throw {message: "Cannot determine user home dir"};
};

function skipWhitespace(s, startIdx)
{
    for (var i = startIdx; i < s.length; i++)
    {
        var cur = s.charAt(i);

        if (cur !== ' ' && cur !== "\t")
            return i;
    }

    return -1;
}

obj.parseArgs = function(s){
    var startQuote = null;
    var args = [];
    var curToken = '';

    var i = skipWhitespace(s, 0);
    if (i < 0) return args;

    for (; i < s.length; )
    {
        var cur = s.charAt(i);

        // inside a quoted arg?
        if (startQuote)
        {
            if (cur === startQuote)
            {
                args.push(curToken.trim());
                curToken = '';
                startQuote = null;
                i = skipWhitespace(s, i+1);
                if (i < 0) return args;
            }
            else
            {
                curToken += cur;
                i++;
            }
        }
        else
        {
            if (cur == '"' || cur == "'")
            {
                curToken = curToken.trim();

                if (curToken !== '')
                {
                    args.push(curToken);
                    curToken = '';
                }

                startQuote = cur;
                i++;
            }
            else if (cur == ' ' || cur == "\t")
            {
                args.push(curToken.trim());
                curToken = '';
                i = skipWhitespace(s, i+1);
                if (i < 0) return args;
            }
            else
            {
                curToken += cur;
                i++;
            }
        }
    }

    if (startQuote)
        throw new errors.UnmatchedQuote();

    if (curToken !== '')
        args.push(curToken.trim());

    return args;
};

/*
function check(s, args){
    var args2 = obj.parseArgs(s);
    if (args2.length != args.length)
    {
        console.log('Failed: '+s);
        return;
    }

    for (var i=0; i < args2.length ;i++)
    {
        if (args2[i] != args[i])
        {
            console.log('Failed: '+s);
            return;
        }
    }
}

check("", []);
check(" ", []);
check("  ", []);
check("a", ['a']);
check(" a", ['a']);
check("a ", ['a']);
check(" a ", ['a']);
check("  a  ", ['a']);
check("'hello'", ['hello']);
check(" 'hello'", ['hello']);
check("'hello' ", ['hello']);
check(" 'hello' ", ['hello']);
check("  'hello world'  ", ['hello world']);
check("'hello'abc", ['hello','abc']);
check("'hello' abc", ['hello','abc']);
check("'hello' abc ", ['hello','abc']);
check("'hello world' abc", ['hello world','abc']);
check("'hello' 'hello there'", ['hello','hello there']);
check("hello 'hello there'", ['hello','hello there']);
check("'hello' \"\" 'hello there'", ['hello','','hello there']);
check("'hello'\"\"'hello there'", ['hello','','hello there']);
console.log('ok');
*/

})(module.exports);
