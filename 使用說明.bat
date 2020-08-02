@echo off
echo 此程式由https://github.com/lucastan/uva-node改寫而來
echo 如果沒安裝過node請安裝，檔案放在資料夾底下名為"node-v10.15.3-x64.msi"
echo 第一次使用務必打add uva {帳號}{密碼}以及use {帳號}
echo 如果要批次提交請將xlsx檔改名成re.xlsx並將此檔案放入file資料夾內
echo 裡面已經有文件，直接覆蓋即可
echo 如果確認上述步驟皆已完成請輸入bs
echo 直到看到"=====輸出結果====="<-此行，代表程式已經跑完
echo 則會此資料夾看到檔案"result.xlsx"
echo 打開即代表輸出結果
npm install & npm start
pause