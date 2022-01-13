//const { encryptPayload } = util;
const url = require('url');
const querystring = require('querystring');
const utils  =  require('../lib/util');
const Session = require('../models/Session')
const AuthorizationCode = require('../models/AuthorizationCode')
var jwt = require('jsonwebtoken')
const uid = require('uid-safe');

const Router  =  require('express').Router;

module.exports = ({ docClient, globalConfiguration, cryptoKeys, globalHooksConfiguration }) => {
    let api = Router();

    api.get('/', async (req, res) => {
        const queryObject = url.parse(req.url,true).query;

        // validate client_id
        if (queryObject.client_id == null){
            return res.status(400).send({error: 'invalid_request', error_description: 'client_id is missing'});
        }

        const clientData = await utils.getClientCredentials(docClient, globalConfiguration, queryObject.client_id);
        if (clientData ==null || clientData.Item ==null){
            return res.status(400).send({error: 'invalid_request', error_description: 'client_id is not valid'});
        }
                
        // validate redirect_uri
        if (queryObject.redirect_uri == null) {
            return res.status(400).send({error: 'invalid_request', error_description: 'redirect_uri is missing'});
        }
        if (clientData.Item.callback_urls == null || !clientData.Item.callback_urls.includes(queryObject.redirect_uri)){
            return res.status(400).send({error: 'invalid_request', error_description: 'redirect_uri is not allowed'});
        }        
        
        var issuer = utils.getCurrentOPHttpProtocol(req) + "://" + utils.getCurrentOPHost(req, globalConfiguration.wellKnownConfiguration.hosts_supported) + "/";        
        let cookie = req.cookies['sso_session'];
        if(cookie) {
            const get_session_params = {
              TableName : globalConfiguration.dynamoDBTablesNames.ssoSession,
                Key:{
                    "id": cookie
                }          
            }        
            const sessionData = await docClient.get(get_session_params).promise();
            //console.log("sessionData: ", sessionData)
            if(sessionData==null || sessionData.Item==null || sessionData.Item.user==null) {
                if(queryObject.state) {
                    var originalState =  queryObject.state;
                    delete queryObject.state;
                    queryObject.state = utils.encryptPayload(originalState, cryptoKeys.stateEncryptionKey);
                }
                    
                var queryParams = querystring.stringify(queryObject, "&", "=")                
                const loginPageUrl = issuer + 'login-page?' + queryParams;
                res.writeHead(302, {
                  location: loginPageUrl
                });
                return res.end();                
            }
            
            var user = sessionData.Item.user;
                         
              try {
                var params = {
                    request: req,
                    redirect_uri: queryObject.redirect_uri,
                    nonce: queryObject.nonce,
                    client_id: queryObject.client_id,
                    scope: queryObject.scope,
                    response_type: queryObject.response_type,
                    state: queryObject.state,
                    ui_locales: queryObject.ui_locales                        
                };
                
                var hookScript = '../../configuration/hooks/post_authentication_hook.js';
                const handler = await import(hookScript);
                // TODO: run a for loop of all the rules here to enhance to id_token
                handler.default(user, params, globalHooksConfiguration.configuration, function (error, user, params) {
                    //console.log(user)
                    //console.log(error);
                    if (user) {
                        // store session in the database
                        const update_params = {
                          TableName : globalConfiguration.dynamoDBTablesNames.ssoSession,
                          Item: sessionData,
                          ReturnValues: "NONE"
                        }
                        // set last_used_username and cache time
                        update_params.Item.user = user;
                        update_params.Item.ttl = Math.floor(Date.now() / 1000) + 900000 /*dynamodb_ttl*/;
                        // TODO: update session data in DB
                        //docClient.update(update_params, function(err, data) { 
                            var location = params.redirect_uri;
                            if(params.response_type==='id_token') {
                                const jwtOptions = {
                                    algorithm: 'RS256', 
                                    keyid: cryptoKeys.jwksJson.keys[0].kid,
                                    audience: params.client_id, 
                                    issuer: issuer, 
                                    expiresIn: cryptoKeys.JWT_EXPIRY_SECONDS
                                }                                    
                                var claims = utils.getIdTokenClaims(user.id, user, params.scope, params.nonce);
                                var token = jwt.sign(claims, cryptoKeys.privateKey, jwtOptions);
                                location = queryObject.redirect_uri + '?id_token=' + token;
                                if (queryObject.state) location += '&state=' + queryObject.state;
                                res.writeHead(302, {
                                  location: location
                                });
                                res.end();                                
                            }else{ // default: return authorization code
                                var code = uid.sync(40);
                                var authorizationCode = new AuthorizationCode(code, sessionData.sessionId, params.client_id, user.id, params.scope, params.nonce);                            
                                location = params.redirect_uri + '?code=' + code;
                                // store session in the database
                                const create_params = {
                                  TableName : globalConfiguration.dynamoDBTablesNames.authorizationCode,
                                  Item: authorizationCode,
                                  ReturnValues: "NONE"
                                }
                                create_params.Item.ttl = Math.floor(Date.now() / 1000) + 100 /*dynamodb_ttl*/;
                                docClient.put(create_params, function(err, data) {
                                    if (params.state) location += '&state=' + params.state;
                                    res.writeHead(302, {
                                      location: location
                                    });
                                    res.end();
                                });  
                                                                    
                            }
                        //});                      
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
                });
              } catch(err) {
                var error = { 
                    errors: [
                        {status: "500", code: err.code, title: "Internal Server Error", detail: err.message}
                    ]
                }           
                return res.status(500).send(error);
              }     
        }else{
            if(queryObject.state) {
                var originalState =  queryObject.state;
                delete queryObject.state;
                queryObject.state = utils.encryptPayload(originalState, cryptoKeys.stateEncryptionKey);
            }
                
            var queryParams = querystring.stringify(queryObject, "&", "=")
            
            res.writeHead(302, {
              location: '/login-page?' + queryParams
            });
            res.end();
        }
    });
                
    return api;
}