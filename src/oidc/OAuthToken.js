const Router  =  require('express').Router;
var jwt = require('jsonwebtoken')
const utils  =  require('../lib/util');
const uid = require('uid-safe');
const RefreshToken = require('../models/RefreshToken')
const Session = require('../models/Session')

module.exports = ({ docClient, globalConfiguration, cryptoKeys, authenticationScriptConfiguration, postAuthenticationConfiguration }) => {
    let api = Router();

    api.post('/', async (req, res) => {
        var client_id = req.body.client_id;
        var grant_type = req.body.grant_type;
        var redirect_uri = req.body.redirect_uri;
        console.log(req.body);

        // validate client_id
        if (req.body.client_id == null){
            return res.status(400).send({error: 'invalid_request', error_description: 'client_id is missing'});
        }

        const clientData = await utils.getClientCredentials(docClient, globalConfiguration, req.body.client_id);
        if (clientData ==null || clientData.Item ==null){
            return res.status(400).send({error: 'invalid_request', error_description: 'client_id is not valid'});
        }
                
        var context = {
            request: req,
            grant_type: grant_type,
            redirect_uri: redirect_uri,
            scope: req.body.scope,
            client_id: req.body.client_id
        }
        
        var issuer = utils.getCurrentIssuer(req.hostname);
                
        if ( context.grant_type === 'authorization_code' || context.grant_type === 'refresh_token'  ) { // authorization code grant
            if (context.grant_type === 'authorization_code') {
                // validate redirect_uri
                if (req.body.redirect_uri == null) {
                    return res.status(400).send({error: 'invalid_request', error_description: 'redirect_uri is missing'});
                }
                if (clientData.Item.callback_urls == null || !clientData.Item.callback_urls.includes(req.body.redirect_uri)){
                    return res.status(400).send({error: 'invalid_request', error_description: 'redirect_uri is not allowed'});
                }

                // validate client_secret
                if (req.body.client_secret == null) {
                    return res.status(400).send({error: 'invalid_request', error_description: 'client_secret is missing'});
                }
                if (clientData.Item.client_secret == null || req.body.client_secret !== clientData.Item.client_secret){
                    return res.status(400).send({error: 'invalid_request', error_description: 'client_secret mismatch'});
                }
                                        
                // TODO: validate required parameters as per the spec
                var code = req.body.code;
                // get from the dynamodb
                const get_code_params = {
                  TableName : globalConfiguration.dynamoDBTablesNames.authorizationCode,
                    Key:{
                        "code": code
                    }          
                }            
                const codeData = await docClient.get(get_code_params).promise();
                console.log(codeData);
                context.scope = codeData.Item.scope;
                context.nonce = codeData.Item.nonce;
                context.client_id = codeData.Item.client_id;
                context.session_id =  codeData.Item.session_id;
            } else {
                 // TODO: validate required parameters as per the spec        
                var token = req.body.refresh_token;
                // get from the dynamodb
                const get_refreshtoken_params = {
                  TableName : globalConfiguration.dynamoDBTablesNames.refreshToken,
                    Key:{
                        "token": token
                    }          
                }
                const refreshTokenData = await docClient.get(get_refreshtoken_params).promise();
                if (refreshTokenData==null || refreshTokenData.Item==null || refreshTokenData.Item.subject == null){
                    return res.status(400).send({error: 'invalid_request', error_description: 'refresh_token is invalid'});
                }                
                console.log(refreshTokenData);
                context.scope = refreshTokenData.Item.scope || 'openid given_name family_name email';
                context.nonce = refreshTokenData.Item.nonce;
                context.client_id = refreshTokenData.Item.client_id;
                context.session_id =  refreshTokenData.Item.session_id;               
            }
            
            const get_session_params = {
              TableName : globalConfiguration.dynamoDBTablesNames.ssoSession,
                Key:{
                    "id": context.session_id
                }          
            }        
            const sessionData = await docClient.get(get_session_params).promise();
            console.log(sessionData);
            
            var user = sessionData.Item.user;
              try {
                var hookScript = '../../configuration/hooks/post_authentication_hook.js';
                const handler = await import(hookScript);
                // TODO: run a for loop of all the rules here to enhance to id_token
                handler.default(user, context, postAuthenticationConfiguration.configuration, async function (error, user, context) {
                    console.log(user);
                    if (user) {
                        const jwtOptions = {
                            algorithm: 'RS256', 
                            keyid: cryptoKeys.jwksJson.keys[0].kid, 
                            audience: client_id, 
                            issuer: issuer, 
                            expiresIn: cryptoKeys.JWT_EXPIRY_SECONDS
                        }                        
                        var claims = utils.getIdTokenClaims(user.id, user, context.scope, context.nonce);
                        var id_token = jwt.sign(claims, cryptoKeys.privateKey, jwtOptions);
                        var access_token = jwt.sign({sub: user.id}, cryptoKeys.privateKey, jwtOptions);
                        var response = {
                            token_type: 'Bearer',
                            expires_in: cryptoKeys.JWT_EXPIRY_SECONDS,
                            id_token: id_token,
                            access_token: access_token
                        }
                        if(context.grant_type==='authorization_code' && context.scope.includes('offline_access')) {
                            var token = uid.sync(40);
                            var refreshToken = new RefreshToken(token, sessionData.Item.id, context.client_id, user.id, context.scope, context.nonce);                            
                            // store refreshToken in the database
                            const create_params = {
                              TableName : globalConfiguration.dynamoDBTablesNames.refreshToken,
                              Item: refreshToken,
                              ReturnValues: "NONE"
                            }
                            const result = await docClient.put(create_params).promise();
                            console.log(result);
                            // TODO: add error handling
                            response.refresh_token = token;
                        }
                        return res.status(200).send(response);
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
        } else if ( context.grant_type === 'password' ) {  // resource owner grant
            // TODO: validate required parameters as per the spec
            var username = req.body.username;
            var password = req.body.password;                    
            context.scope = req.body.scope;
            context.client_id = client_id;
            
              try {
                var loginScript = '../../configuration/authentication/authentication_script.js';
                const handler = await import(loginScript);
                handler.default(username, password, authenticationScriptConfiguration, function (error, user) {
                    if (user) {
                        const jwtOptions = {
                            algorithm: 'RS256', 
                            keyid: cryptoKeys.jwksJson.keys[0].kid,
                            audience: client_id, 
                            issuer: issuer, 
                            expiresIn: cryptoKeys.JWT_EXPIRY_SECONDS
                        }
                        var claims = utils.getIdTokenClaims(user.id, user, context.scope, null);
                        jwt.sign(claims, cryptoKeys.privateKey, jwtOptions, async function(err, token) {
                            var access_token = jwt.sign({sub: user.id}, cryptoKeys.privateKey, jwtOptions);
                            var response = {
                                "id_token": token,
                                "scope": context.scope,
                                "access_token": access_token,
                                "token_type": "bearer"
                            }
                            if(context.scope.includes('offline_access')) {
                                var sessionId = uid.sync(40);
                                var token = uid.sync(40);
                                var refreshToken = new RefreshToken(token, sessionId, context.client_id, user.id, context.scope, null);                            
                                // store refreshToken in the database
                                const create_params = {
                                  TableName : globalConfiguration.dynamoDBTablesNames.refreshToken,
                                  Item: refreshToken,
                                  ReturnValues: "NONE"
                                }
                                const result = await docClient.put(create_params).promise();
                                console.log(result);
                                // TODO: add error handling
                                response.refresh_token = token;

                                // store session in the database
                                var session = new Session(sessionId, user.id);
                                const create_session_params = {
                                  TableName : globalConfiguration.dynamoDBTablesNames.ssoSession,
                                  Item: session,
                                  ReturnValues: "NONE"
                                }
                                // set session in db
                                create_session_params.Item.user = user;
                                create_session_params.Item.ttl = Math.floor(Date.now() / 1000) + 900000 /*dynamodb_ttl*/;
                                docClient.put(create_session_params).promise();
                            }
                            return res.status(200).send(response);
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
                });
              } catch(err) {
                var error = { 
                    errors: [
                        {status: "500", code: err.code, title: "Internal Server Error", detail: err.message}
                    ]
                }           
                return res.status(500).send(error);
              }     
        } else if ( context.grant_type === 'urn:ietf:params:oauth:grant-type:jwt-bearer' ) {  // jwt-bearer grant
            // TODO: validate required parameters as per the spec
            var username = req.body.username;
            var password = req.body.password;                    
            context.scope = req.body.scope;
            context.client_id = client_id;
            
              try {
                var loginScript = '../../configuration/authentication/authentication_script.js';
                const handler = await import(loginScript);
                handler.default(username, password, authenticationScriptConfiguration, function (error, user) {
                    if (user) {
                        const jwtOptions = {
                            algorithm: 'RS256', 
                            keyid: cryptoKeys.jwksJson.keys[0].kid,
                            audience: client_id, 
                            issuer: issuer, 
                            expiresIn: cryptoKeys.JWT_EXPIRY_SECONDS
                        }
                        var claims = utils.getIdTokenClaims(user.id, user, context.scope, null);
                        jwt.sign(claims, cryptoKeys.privateKey, jwtOptions, async function(err, token) {
                            var access_token = jwt.sign({sub: user.id}, cryptoKeys.privateKey, jwtOptions);
                            var response = {
                                "id_token": token,
                                "scope": context.scope,
                                "access_token": access_token,
                                "token_type": "bearer"
                            }
                            if(context.scope.includes('offline_access')) {
                                var sessionId = uid.sync(40);
                                var token = uid.sync(40);
                                var refreshToken = new RefreshToken(token, sessionId, context.client_id, user.id, context.scope, null);                            
                                // store refreshToken in the database
                                const create_params = {
                                  TableName : globalConfiguration.dynamoDBTablesNames.refreshToken,
                                  Item: refreshToken,
                                  ReturnValues: "NONE"
                                }
                                const result = await docClient.put(create_params).promise();
                                console.log(result);
                                // TODO: add error handling
                                response.refresh_token = token;

                                // store session in the database
                                var session = new Session(sessionId, user.id);
                                const create_session_params = {
                                  TableName : globalConfiguration.dynamoDBTablesNames.ssoSession,
                                  Item: session,
                                  ReturnValues: "NONE"
                                }
                                // set session in db
                                create_session_params.Item.user = user;
                                create_session_params.Item.ttl = Math.floor(Date.now() / 1000) + 900000 /*dynamodb_ttl*/;
                                docClient.put(create_session_params).promise();
                            }
                            return res.status(200).send(response);
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
                });
              } catch(err) {
                var error = { 
                    errors: [
                        {status: "500", code: err.code, title: "Internal Server Error", detail: err.message}
                    ]
                }           
                return res.status(500).send(error);
              }     
        } else if ( context.grant_type === 'client_credentials' ) {  // client_credentials grant
            // TODO: validate required parameters as per the spec
            var username = req.body.username;
            var password = req.body.password;                    
            context.scope = req.body.scope;
            context.client_id = client_id;
            
              try {
                var loginScript = '../../configuration/authentication/authentication_script.js';
                const handler = await import(loginScript);
                handler.default(username, password, authenticationScriptConfiguration, function (error, user) {
                    if (user) {
                        const jwtOptions = {
                            algorithm: 'RS256', 
                            keyid: cryptoKeys.jwksJson.keys[0].kid,
                            audience: client_id, 
                            issuer: issuer, 
                            expiresIn: cryptoKeys.JWT_EXPIRY_SECONDS
                        }
                        var claims = utils.getIdTokenClaims(user.id, user, context.scope, null);
                        jwt.sign(claims, cryptoKeys.privateKey, jwtOptions, async function(err, token) {
                            var access_token = jwt.sign({sub: user.id}, cryptoKeys.privateKey, jwtOptions);
                            var response = {
                                "id_token": token,
                                "scope": context.scope,
                                "access_token": access_token,
                                "token_type": "bearer"
                            }
                            if(context.scope.includes('offline_access')) {
                                var sessionId = uid.sync(40);
                                var token = uid.sync(40);
                                var refreshToken = new RefreshToken(token, sessionId, context.client_id, user.id, context.scope, null);                            
                                // store refreshToken in the database
                                const create_params = {
                                  TableName : globalConfiguration.dynamoDBTablesNames.refreshToken,
                                  Item: refreshToken,
                                  ReturnValues: "NONE"
                                }
                                const result = await docClient.put(create_params).promise();
                                console.log(result);
                                // TODO: add error handling
                                response.refresh_token = token;

                                // store session in the database
                                var session = new Session(sessionId, user.id);
                                const create_session_params = {
                                  TableName : globalConfiguration.dynamoDBTablesNames.ssoSession,
                                  Item: session,
                                  ReturnValues: "NONE"
                                }
                                // set session in db
                                create_session_params.Item.user = user;
                                create_session_params.Item.ttl = Math.floor(Date.now() / 1000) + 900000 /*dynamodb_ttl*/;
                                docClient.put(create_session_params).promise();
                            }
                            return res.status(200).send(response);
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
                });
              } catch(err) {
                var error = { 
                    errors: [
                        {status: "500", code: err.code, title: "Internal Server Error", detail: err.message}
                    ]
                }           
                return res.status(500).send(error);
              }     
        }        
        
    });
                
    return api;
}     