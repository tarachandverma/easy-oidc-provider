const Session = require('../models/Session')
const utils  =  require('../lib/util');
const uid = require('uid-safe')
const Router  =  require('express').Router;
var jwt = require('jsonwebtoken')
const AuthorizationCode = require('../models/AuthorizationCode')
const url = require('url');
const axios = require('axios');
const jwksClient = require('jwks-rsa');

const SESSION_EXPIRY_SECONDS_DEFAULT = 180 * 24 * 60 * 60 * 1000; // 6 months

function setResponseHeadersAndGetLocation(res, responseHeaders) {
    let location = null;
    if (responseHeaders.length>0) {
        responseHeaders.forEach(function(header){
            if(header.name==='location') {
                location = header.value;
            }else{
                res.setHeader(header.name, header.name.value);
            }
        });
    }
    return location;    
}

module.exports = ({ docClient, globalConfiguration, cryptoKeys, globalHooksConfiguration }) => {
    var SESSION_EXPIRY_MILLIS = 1000 * (globalConfiguration.sessionExpirySeconds || SESSION_EXPIRY_SECONDS_DEFAULT);    
    let api = Router();

    // idp_connections like google, facebook etc
    api.get('/:connection_id', async (req, res) => {
        // TODO: handle external identity providers response
        let opstate = req.cookies['opstate'];
        if(opstate != null) {
            var requestParams = utils.decryptPayload(opstate, cryptoKeys.stateEncryptionKey);
            if(requestParams!=null) console.log(requestParams);
        }
        if(req.params.connection_id) {
            //console.log(req.params.connection_id);
            const idpConnectionData = await utils.getIdpConnection(docClient, globalConfiguration, req.params.connection_id);
            if (idpConnectionData ==null || idpConnectionData.Item ==null){
                return utils.sendErrorResponse(res, null, 'invalid_request', 'connection_id is not valid');
            }
            //console.log(idpConnectionData);
            var idpConnection =  idpConnectionData.Item;                   
            // validate redirect_uri
            if (idpConnection.protocol == null) {
                return utils.sendErrorResponse(res, null, 'invalid_request', 'invalid connection protocol');            
            }
            if (idpConnection.protocol !== 'oauth2' || idpConnection.oauth2_relying_party_settings == null) {
                return utils.sendErrorResponse(res, null, 'invalid_request', 'only oauth2 connection protocol is supported right now');                               
            }
            
            if (idpConnection.oauth2_protocol_settings == null) {
                return utils.sendErrorResponse(res, null, 'invalid_request', 'oauth2_protocol_settings is not enabled');                               
            }            

            const queryObject = url.parse(req.url,true).query;
            console.log("code=", queryObject.code);
            console.log("id_token=", queryObject.id_token);
            if(queryObject.code) {
                var domainHost = utils.getCurrentOPHttpProtocol(req) + "://" + utils.getCurrentOPHost(req, globalConfiguration.wellKnownConfiguration.hosts_supported);            
                // TODO: make a token all
                let data = {                 
                    grant_type: 'authorization_code',
                    client_id: idpConnection.oauth2_relying_party_settings.client_id,
                    client_secret: idpConnection.oauth2_relying_party_settings.client_secret,
                    code: queryObject.code,
                    redirect_uri: domainHost + req.baseUrl + req.path 
                };
                console.log(data);
                let response = null;
                const headers = {
                  'Content-Type': 'application/json'
                }                        
                try {
                    response = await axios.post(idpConnection.oauth2_protocol_settings.token_endpoint, data, {headers: headers})
                } catch (error) {
                     console.log(error.response.data);  
                     console.log(error.response.status);
                     return res.status(error.response.status).json(error.response.data);  
                }
                if(response) {
                    console.log(response)
                }
            }else if(queryObject.id_token) {
                const client = jwksClient({
                  cache: true, // Default Value
                  cacheMaxEntries: 5, // Default value
                  cacheMaxAge: 600000, // Defaults to 10m                    
                  jwksUri: idpConnection.oauth2_protocol_settings.jwks_uri,
                  timeout: 30000 // Defaults to 30s
                });                
                var user = null; 
                try {
                    const decoded = jwt.decode(queryObject.id_token, {complete: true});
                    console.log("decoded:", decoded)
                    const kid = decoded.header.kid;
                    const key = await client.getSigningKey(kid);
                    const signingKey = key.getPublicKey();                    
                    var payload = jwt.verify(queryObject.id_token, signingKey, { algorithms: ['RS256']});
                    user = payload;
                    console.log(user);
                }
                catch (ex) { console.log(ex.message); }
            }         
                        
        }                
        res.location('/api/idp_connections/' + req.params.connection_id);
        res.status(302).json({});
    });
    
    api.post('/', async (req, res) => {
        //console.log(req.body);
        var userToken = req.body.token;
    
        var user = null;    
        try {
            const decoded = jwt.verify(userToken, cryptoKeys.publicKey, { algorithms: ['RS256']});
            user = decoded;
        }
        catch (ex) { console.log(ex.message); }
                
        var requestParams = JSON.parse(decodeURIComponent(req.body.params));
        //console.log('requestParams', requestParams);
        
        var client_id = requestParams.client_id;
        // validate client_id
        if (requestParams.client_id == null){
            return utils.sendErrorResponse(res, null, 'invalid_request', 'client_id is missing');
        }
       
        const clientData = await utils.getClientCredentials(docClient, globalConfiguration, requestParams.client_id);
        if (clientData ==null || clientData.Item ==null){
            return utils.sendErrorResponse(res, null, 'invalid_request', 'client_id is not valid');
        }
        
        var originalState=null;
        if (requestParams.state) {
            originalState = utils.decryptPayload(requestParams.state, cryptoKeys.stateEncryptionKey);
            if(originalState==null) originalState = requestParams.state;
        }
        var issuer = utils.getCurrentOPHttpProtocol(req) + "://" + utils.getCurrentOPHost(req, globalConfiguration.wellKnownConfiguration.hosts_supported) + "/";
        var params = {
            request: req,
            response_type: requestParams.response_type,
            client_id: requestParams.client_id,
            client_name: clientData.Item.client_name,
            redirect_uri: requestParams.redirect_uri,
            state: originalState,
            scope: requestParams.scope,
            nonce: requestParams.nonce,
            issuer: issuer,
            response_headers: new Array(1)
        };
          try {
            var hookScript = '../../configuration/hooks/post_authentication_hook.js';
            const handler = await import(hookScript);
            // Run script here to enhance to id_token
            handler.default(user, params, globalHooksConfiguration.configuration, function (error, user, params) {
                //console.log(params.response_headers);
                var location = setResponseHeadersAndGetLocation(res, params.response_headers);
                if(location) {
                    return res.redirect(location);
                }
                            
                if (user) {
                    var sessionId = uid.sync(40);
                    var session = new Session(sessionId, user.id);
                    // store session in the database
                    const create_params = {
                      TableName : globalConfiguration.dynamoDBTablesNames.ssoSession,
                      Item: session,
                      ReturnValues: "NONE"
                    }
                    // set session in db
                    create_params.Item.user = user;
                    create_params.Item.ttl = Math.floor(Date.now() / 1000) + SESSION_EXPIRY_MILLIS/1000 /*dynamodb_ttl*/;
                    docClient.put(create_params, function(err, data) {
                        //console.log(err);
                        res.cookie("session", sessionId, { maxAge: SESSION_EXPIRY_MILLIS, expires: new Date(Date.now() + SESSION_EXPIRY_MILLIS), httpOnly: true, secure: true, sameSite: "none" })

                        var location = params.redirect_uri;
                        if(requestParams.response_type==='id_token') {
                            const jwtOptions = {
                                algorithm: 'RS256', 
                                keyid: cryptoKeys.jwksJson.keys[0].kid, 
                                audience: client_id, 
                                issuer: issuer, 
                                expiresIn: cryptoKeys.JWT_EXPIRY_SECONDS
                            }
                            var claims = utils.getIdTokenClaims(user.id, user, requestParams.scope, requestParams.nonce);
                            var token = jwt.sign(claims, cryptoKeys.privateKey, jwtOptions);
                            location = params.redirect_uri + '?id_token=' + token;
                            if (originalState) location += '&state=' + originalState;
                            res.writeHead(302, {
                              location: location
                            });
                            res.end();                                
                        }else{ // default: return authorization code
                            var code = uid.sync(40);
                            var authorizationCode = new AuthorizationCode(code, sessionId, requestParams.client_id, user.id, 
                            	requestParams.scope, requestParams.nonce, requestParams.code_challenge, requestParams.code_challenge_method);
                            location = params.redirect_uri + '?code=' + code;
                            // store session in the database
                            const create_params = {
                              TableName : globalConfiguration.dynamoDBTablesNames.authorizationCode,
                              Item: authorizationCode,
                              ReturnValues: "NONE"
                            }
                            create_params.Item.ttl = Math.floor(Date.now() / 1000) + 100 /*dynamodb_ttl*/;
                            docClient.put(create_params, function(err, data) {
                                if (originalState) location += '&state=' + originalState;
                                res.writeHead(302, {
                                  location: location
                                });
                                res.end();
                            });  
                                                                
                        }
                    });                      
                } else if (error) {
                    return res.status(401).send(error);
                } else {
                    var error = { 
                        errors: [
                            {status: "500", code: "INVALID_RESPONSE", title: "Internal Server Error"}
                        ]
                    }
                    return res.status(500).send(error);
                }
                }).catch( err => {
                    console.log("post_authentication_hook.js load error:", err);
                    res.status(500).send(err);
                });
          } catch(err) {
            var error = { 
                errors: [
                    {status: "500", code: err.code, title: "Internal Server Error", detail: err.message}
                ]
            }           
            return res.status(500).send(error);
          }     
    });
                
    return api;
}    