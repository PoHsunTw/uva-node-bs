var fs        = require('fs'),
    path      = require('path'),
    request   = require('request'),
    url       = require('url'),
    xlsx2json = require("node-xlsx"),
    async     = require('async'),
    fs        = require("fs");

var list = xlsx2json.parse("./file/re.xlsx" );
var downloadDir = './code/'

var data = [...(list[0].data)];

const debug = true;
var fileUrl = [];
var ID = [];
var ID2UVA = [];
var code_amount = 0;

module.exports = 
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
                r.pipe(fs.createWriteStream(path.join(__dirname, downloadDir+filename)));
                fileInfo = filename.split('-');
                var fileInfo_id = fileInfo[0].replace(/ /gi,'');
                var fileInfo_uva = fileInfo[1].replace(/uva/gi,'').replace(/ /gi,'');
                if(isNaN(fileInfo_id)||isNaN(fileInfo_uva)){
                    //file format wrong!!
                    console.log('id:'+fileInfo_id+' UVA:'+fileInfo_uva+' format is wrong!');
                }else{
                    //file format wrong!!
                    ID.push(fileInfo_id);
                    ID2UVA.push(fileInfo_uva);
                    if(debug) console.log('id:'+fileInfo_id+' UVA:'+fileInfo_uva);
                    code_amount++;
                }
                resolve();
            });
        });
    }

    async function dataPreprocessing(data) {
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
        for(let i = fileUrl.length-1; i >= 0; --i){
            await Download_File(fileUrl.pop());

        }
        console.log('=====Total File(s):'+ID2UVA.length+'=====');
        for (let i = ID2UVA.length-1 ; i >= 0 && debug; i--) {
            console.log(ID.pop()+':'+ID2UVA.pop());
        }
    }

    dataPreprocessing(data);
    if(debug) console.log('end line');