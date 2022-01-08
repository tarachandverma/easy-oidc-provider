const Session = require('../models/Session')
const utils  =  require('../lib/util');
const uid = require('uid-safe')
const Router  =  require('express').Router;
var jwt = require('jsonwebtoken')
const AuthorizationCode = require('../models/AuthorizationCode')

module.exports = ({ docClient, globalConfiguration, cryptoKeys, postAuthenticationConfiguration }) => {
    let api = Router();

    api.post('/', async (req, res) => {
        //console.log(req.body);
        var userToken = req.body.token;
    
        var user = null;    
        try {
            // TODO: must implement verification
            const decoded = jwt.verify(userToken, cryptoKeys.publicKey, { algorithms: ['RS256']});
            user = decoded;
        }
        catch (ex) { console.log(ex.message); }
                
        var requestContext = JSON.parse(req.body.ctx);
        //console.log('RequestContext', requestContext);
        
        var context = {
            request: req,
            redirect_uri: requestContext.redirect_uri
        }
        
        var client_id = requestContext.client_id;
        // validate client_id
        if (requestContext.client_id == null){
            return res.status(400).send({error: 'invalid_request', error_description: 'client_id is missing'});
        }
       
        const clientData = await utils.getClientCredentials(docClient, globalConfiguration, requestContext.client_id);
        if (clientData ==null || clientData.Item ==null){
            return res.status(400).send({error: 'invalid_request', error_description: 'client_id is not valid'});
        }
        
        var originalState=null;
        if (requestContext.state) {
            originalState = utils.decryptPayload(requestContext.state, cryptoKeys.stateEncryptionKey)
        }
        var issuer = utils.getCurrentIssuer(req.hostname);
          try {
            var hookScript = '../../configuration/hooks/post_authentication_hook.js';
            const handler = await import(hookScript);
            // TODO: run a for loop of all the rules here to enhance to id_token
            handler.default(user, context, postAuthenticationConfiguration.configuration, function (error, user, context) {
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
                    create_params.Item.ttl = Math.floor(Date.now() / 1000) + 900000 /*dynamodb_ttl*/;
                    docClient.put(create_params, function(err, data) {
                        //console.log(err);
                        res.cookie("session", sessionId, { expires: new Date(Date.now() + 900000), httpOnly: true, secure: true, sameSite: "none" })

                        var location = context.redirect_uri;
                        if(requestContext.response_type==='id_token') {
                            const jwtOptions = {
                                algorithm: 'RS256', 
                                keyid: cryptoKeys.jwksJson.keys[0].kid, 
                                audience: client_id, 
                                issuer: issuer, 
                                expiresIn: cryptoKeys.JWT_EXPIRY_SECONDS
                            }
                            var claims = utils.getIdTokenClaims(user.id, user, requestContext.scope, requestContext.nonce);
                            var token = jwt.sign(claims, cryptoKeys.privateKey, jwtOptions);
                            location = context.redirect_uri + '?id_token=' + token;
                            if (originalState) location += '&state=' + originalState;
                            res.writeHead(302, {
                              location: location
                            });
                            res.end();                                
                        }else{ // default: return authorization code
                            var code = uid.sync(40);
                            var authorizationCode = new AuthorizationCode(code, sessionId, requestContext.client_id, user.id, requestContext.scope, requestContext.nonce);                            
                            location = context.redirect_uri + '?code=' + code;
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