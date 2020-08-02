const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const util = require('./util');

const KEY_FILE_NAME = "uva-node.key";
const SSH_PATH = path.join(util.getUserHomePath(), ".ssh");
const KEY_PATH = path.join(SSH_PATH, KEY_FILE_NAME);

/** Key strength in bits. */
const KEY_STRENGTH = 128;

const ALGO = 'AES'+KEY_STRENGTH;

/**
 * Creates, saves and returns a random password key.
 * @return Buffer holding the password bytes. 
 */
function createKey()
{
    var buf = crypto.randomBytes(KEY_STRENGTH / 8);
    var hex = buf.toString('hex');
    var opts = {
        encoding: 'ascii', // encoding cannot be hex
        mode: 0600,        // only user R/W 
        flag: 'w'          // create if not exist, truncate otherwise
    };

    if (! fs.existsSync(SSH_PATH))
        fs.mkdirSync(SSH_PATH, 0644); // user R/W, group & other R 
    
    fs.writeFileSync(KEY_PATH, hex, opts);

    return buf;
}

/**
 * Gets or creates the password key if necessary.
 * @return Buffer holding the password bytes.
 */
function getKey()
{
    var keyExists = fs.existsSync(KEY_PATH);
    if (!keyExists) return createKey();

    var contents = fs.readFileSync(KEY_PATH, {encoding: 'ascii'});
    return new Buffer(contents.trim(), 'hex');
}

const KEY_BUF = getKey();

module.exports = {
    /**
     * Generates a random IV and encrypts a buffer.
     * @param dataBuf Data buffer to encrypt.
     * @return An object with the fields: iv and buf, both of which are buffers.
     */
    encrypt: function(dataBuf){
        var iv = crypto.randomBytes(KEY_STRENGTH/8);
        var cipher = crypto.createCipheriv(ALGO, KEY_BUF, iv);
        cipher.end(dataBuf);
        return {buf: cipher.read(), iv: iv};
    },

    /**
     * Decrypts a data buffer.
     * @return Buffer holding the decrypted data.
     */
    decrypt: function(dataBuf, iv){
        var cipher = crypto.createDecipheriv(ALGO, KEY_BUF, iv);
        cipher.end(dataBuf);
        return cipher.read();
    }
};

