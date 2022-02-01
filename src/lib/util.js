const crypto = require("crypto");
const SingletonClientCredentialsCache = require('../client_credentials_cache');
const SingletonIdpConnectionsCache = require('../idp_connections_cache');
const base64url = require("base64url");
// USE IT FOR ENCRYPTING AND STORING IN VAULT
function encryptPayload(payload, encryptionKey) {
    //console.log("#################");
    //console.log("payload: " + payload);
    //console.log("EncryptionKey: " + encryptionKey);    
   
    // generate 16 bytes of random data
    const initVector = crypto.randomBytes(16).toString("base64").slice(0, 16);
    //console.log("initVector: " + initVector);
    
    // make the encrypter function
    const encrypter = crypto.createCipheriv("aes-256-cbc", encryptionKey, initVector);
    
    // encrypt the message
    // set the input encoding
    // and the output encoding
    let encryptedMsg = encrypter.update(payload, "utf-8", "base64");
    
    // stop the encryption using
    // the final method and set
    // output encoding to hex
    encryptedMsg += encrypter.final("base64");
    
    //console.log("Encrypted payload : " + encryptedMsg);
    
    const encryptedPayload = base64url.fromBase64(initVector) + "." + base64url.fromBase64(encryptedMsg);
    //console.log("Encrypted payload with IV prefix: " + encryptedPayload);
    //console.log("#################");
    return encryptedPayload;
}

function decryptPayload(encryptedPayload, decryptionKey) {
    if (encryptedPayload==null ||  decryptionKey==null) return null;
    const tokenElements = encryptedPayload.split('.');
    const initVector = tokenElements[0];
    const encryptedMsg = tokenElements[1];
    
    if (encryptedMsg == null) return null;
    // make the decrypter function
    const decrypter = crypto.createDecipheriv("aes-256-cbc", decryptionKey, base64url.toBase64(initVector));
    
    // decrypt the encrypted payload
    // set the input encoding
    // and the output encoding
    let payload = decrypter.update(base64url.toBase64(encryptedMsg), "base64", "utf8");
    
    // stop the decryption using
    // the final method and set
    // output encoding to utf8
    payload += decrypter.final("utf8");
    //console.log("payload: " + payload);
    
    return payload;
}

const profileScopes = [ 'name', 'given_name', 'family_name', 'updated_at'];

function getIdTokenClaims(subject, user, scope, nonce) {
    let claims = {
        sub: subject
    }
    if(user&&scope) {
        if(nonce) claims.nonce = nonce;
        var scopes = scope.split(' ');
        scopes.forEach(function(scope) {
            if(user[scope]) claims[scope] = user[scope];
            if(scope==='profile') {
                claims.name = user.name
                claims.given_name = user.given_name
                claims.family_name = user.family_name;
                claims.updated_at = user.updated_at
            }
        });                
    }
    
    return claims;
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

function getCurrentOPHost(req, hostnameSupported) {
    var currentOPHost = "localhost";
    if(hostnameSupported) {
        currentOPHost = (hostnameSupported.includes(req.headers.host)) ? req.headers.host : hostnameSupported[0];
    }
    return currentOPHost;
}

function getCurrentOPHttpProtocol(req) {
    return (req.headers['x-forwarded-proto']==='https') ? 'https' : 'http';
}

function sendErrorResponse(res, redirect_uri, error, error_description, state){
    if(redirect_uri == null) {
        return res.status(400).send({error: error, error_description: encodeURI(error_description)});        
    }
    var redirectUriWithQueryChar = redirect_uri;
    redirectUriWithQueryChar = (redirect_uri.includes('?')) ? redirectUriWithQueryChar + '&' : redirectUriWithQueryChar + '?';
    var location = redirectUriWithQueryChar + 'error='+ error + '&error_description='+ encodeURI(error_description);
    if(state) location+= '&state='+ state;
            
    res.writeHead(302, {
      location: location
    });
    return res.end();    
}

function cert_to_x5c (cert, maxdepth) {
  if (maxdepth == null) {
    maxdepth = 0;
  }
  /*
   * Convert a PEM-encoded certificate to the version used in the x5c element
   * of a [JSON Web Key](http://tools.ietf.org/html/draft-ietf-jose-json-web-key).
   *             
   * `cert` PEM-encoded certificate chain
   * `maxdepth` The maximum number of certificates to use from the chain.
   */

  cert = cert.replace(/-----[^\n]+\n?/gm, ',').replace(/\n/g, '');
  cert = cert.split(',').filter(function(c) {
    return c.length > 0;
  });
  if (maxdepth > 0) {
    cert = cert.splice(0, maxdepth);
  }
  return cert;
}

async function getIdpConnection(docClient, globalConfiguration, connection_id) {
    var idpData = null;
    // retrieve client credentials from cache
    const idpConnectionsCache =  SingletonIdpConnectionsCache.getInstance().cache;
    let value = idpConnectionsCache.get(connection_id);
    if ( value == undefined ){
        const get_client_params = {
          TableName : globalConfiguration.dynamoDBTablesNames.idpConnection,
            Key:{
                "id": connection_id
            }          
        }        
        idpConnectionData = await docClient.get(get_client_params).promise();
        if (idpConnectionData && idpConnectionsCache) {
            idpConnectionData.cached_at = Date.now();
            let success = idpConnectionsCache.set( connection_id, idpConnectionData, 86400); // cache it for 24 hrs
        }        
    }else {
        idpConnectionData = value;
    }

    return idpConnectionData;
}
    
module.exports = {
  decryptPayload: decryptPayload,
  encryptPayload: encryptPayload,
  getIdTokenClaims: getIdTokenClaims,
  getClientCredentials: getClientCredentials,
  getCurrentOPHost: getCurrentOPHost,
  getCurrentOPHttpProtocol: getCurrentOPHttpProtocol,
  sendErrorResponse: sendErrorResponse,
  cert_to_x5c: cert_to_x5c,
  getIdpConnection: getIdpConnection,  
};

