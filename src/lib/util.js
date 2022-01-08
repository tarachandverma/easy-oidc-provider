const crypto = require("crypto");
const SingletonClientCredentialsCache = require('../client_credentials_cache');

// USE IT FOR ENCRYPTING AND STORING IN VAULT
function encryptPayload(payload, encryptionKey) {
    //console.log("#################");
    //console.log("payload: " + payload);
    //console.log("EncryptionKey: " + encryptionKey);    
   
    // generate 16 bytes of random data
    const initVector = crypto.randomBytes(16).toString("hex").slice(0, 16);
    //console.log("initVector: " + initVector);
    
    // make the encrypter function
    const encrypter = crypto.createCipheriv("aes-256-cbc", encryptionKey, initVector);
    
    // encrypt the message
    // set the input encoding
    // and the output encoding
    let encryptedMsg = encrypter.update(payload, "utf-8", "hex");
    
    // stop the encryption using
    // the final method and set
    // output encoding to hex
    encryptedMsg += encrypter.final("hex");
    
    //console.log("Encrypted payload : " + encryptedMsg);
    
    const encryptedPayload = initVector + "." + encryptedMsg;
    //console.log("Encrypted payload with IV prefix: " + encryptedPayload);
    //console.log("#################");
    return encryptedPayload;
}

function decryptPayload(encryptedPayload, decryptionKey) {
    if (encryptedPayload==null ||  decryptionKey==null) return null;
    const tokenElements = encryptedPayload.split('.');
    const initVector = tokenElements[0];
    const encryptedMsg = tokenElements[1];
    
    // make the decrypter function
    const decrypter = crypto.createDecipheriv("aes-256-cbc", decryptionKey, initVector);
    
    // decrypt the encrypted payload
    // set the input encoding
    // and the output encoding
    let payload = decrypter.update(encryptedMsg, "hex", "utf8");
    
    // stop the decryption using
    // the final method and set
    // output encoding to utf8
    payload += decrypter.final("utf8");
    //console.log("payload: " + payload);
    
    return payload;
}

function getIdTokenClaims(subject, user, scope, nonce) {
    let claims = {
        sub: subject
    }
    if(user&&scope) {
        if(nonce) claims.nonce = nonce;
        var scopes = scope.split(' ');
        scopes.forEach(function(scope) {
            if(user[scope]) claims[scope] = user[scope];
            if(user['metadata']&&user['metadata'][scope]) claims[scope] = user['metadata'][scope];
        });                
    }
    
    return claims;
}

// TODO: add request host header to issuer mapping here 
const VALID_HOSTNAME_ISSUERS_MAPPING = {
    'op.example.org' : 'https://op.example.org/',
}

function getCurrentIssuer(requestHost) {
    return VALID_HOSTNAME_ISSUERS_MAPPING[requestHost];
}

async function getClientCredentials(docClient, globalConfiguration, client_id) {
    var clientData = null;
    // retrieve client credentials from cache
    const clientCredentialsCache =  SingletonClientCredentialsCache.getInstance().cache;
    let value = clientCredentialsCache.get(client_id);
    if ( value == undefined ){
        const get_client_params = {
          TableName : globalConfiguration.dynamoDBTablesNames.clientCredential,
            Key:{
                "client_id": client_id
            }          
        }        
        clientData = await docClient.get(get_client_params).promise();
        if (clientData && clientCredentialsCache) {
            clientData.cached_at = Date.now();
            let success = clientCredentialsCache.set( client_id, clientData, 86400); // cache it for 24 hrs
        }        
    }else {
        clientData = value;
    }

    return clientData;
}

module.exports = {
  decryptPayload: decryptPayload,
  encryptPayload: encryptPayload,
  getIdTokenClaims: getIdTokenClaims,
  getCurrentIssuer: getCurrentIssuer,
  getClientCredentials: getClientCredentials  
};

