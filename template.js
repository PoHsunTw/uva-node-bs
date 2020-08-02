const fs = require('fs');
const path = require('path');
const util = require('./util');

const CARET_START = /\$caret_start\$/i;

module.exports = (function(){
    var app;
    var tpls;

    function cls(_app, _tpls)
    {
        app = _app;
        tpls = _tpls;

        /**
         * Adds or replaces an existing template.
         * @param filePath The caller must check whether the path exists.
         * @return boolean whether ok.
         */
        this.add = function(filePath){
            var fileExt = util.getFileExt(filePath);
            var lang = util.getLang(fileExt.toLowerCase());
            if (lang < 0)
                return false;

            // check whether exists until we have to open the file
            tpls[lang+''] = filePath;
            return true;
        };

        /**
         * @param lang LANG_* constant
         */
        this.remove = function(lang){
            tpls[lang+''] = null; 
        };

        this.getAll = function(){
            return tpls;
        };

        this.spawn = function(lang, destFilePath){
            var contents = '';
            var srcFilePath = tpls[lang+''];
            if (srcFilePath)
            {
                contents = fs.readFileSync(srcFilePath, {encoding: 'utf8'});    
            }

            var opts = {
                // use default mode (inherit from parent usually)
                encoding: 'utf8',  
                flag: 'w'          // create if not exist, truncate otherwise
            };

            var lineNum = 1;
            var r = {lineNum: -1, colNum: 1};
            var writer = fs.createWriteStream(destFilePath, opts);
            var m;
            var lastIndex = -1;

            // localize this regex since it remembers previous matches
            const LINE_MATCH = /(.*?)(\r\n?|\n|$)/g;

            // Do this to preserve line ending
            while(true)
            {
                m = LINE_MATCH.exec(contents);
                if (!m || LINE_MATCH.lastIndex == lastIndex) break;

                var line = m[1];
                var m2;
                if (r.lineNum < 0 && (m2 = CARET_START.exec(line)))
                {
                    r.lineNum = lineNum;
                    r.colNum = m2.index+1;
                    writer.write(line.substring(0, m2.index), 'utf8');
                }
                else
                {
                    writer.write(line, 'utf8');
                }

                // write the line ending
                writer.write(m[2], 'ascii');
                lineNum++;
                lastIndex = LINE_MATCH.lastIndex;
            }

            writer.end();

            return r;
        };
    }

    return cls;
})();
