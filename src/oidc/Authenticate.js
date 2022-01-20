const Router  =  require('express').Router;
const utils  =  require('../lib/util');
var jwt = require('jsonwebtoken')

module.exports = ({ docClient, globalConfiguration, cryptoKeys, authenticationScriptConfiguration }) => {
    let api = Router();

    api.post('/', async (req, res) => {
        var username = req.body.username;
        var password = req.body.password;
        var scope = req.body.scope || "openid profile";
        var client_id = req.body.client_id;
        var redirect_uri = req.body.redirect_uri;
        var response_type = req.body.response_type || 'code'
        var state = req.body.state || ''
        var nonce = req.body.nonce || ''
        //console.log(req.body);
        const OP_HOST = utils.getCurrentOPHttpProtocol(req) + "://" + utils.getCurrentOPHost(req, globalConfiguration.wellKnownConfiguration.hosts_supported);
        var issuer = OP_HOST + "/";        
        // validate client_id
        if (req.body.client_id == null){
            return res.status(400).send({error: 'invalid_request', error_description: 'client_id is missing'});
        }

        const clientData = await utils.getClientCredentials(docClient, globalConfiguration, req.body.client_id);
        if (clientData ==null || clientData.Item ==null){
            return res.status(400).send({error: 'invalid_request', error_description: 'client_id is not valid'});
        }
                
        try {
            const handler = await import('../../configuration/authentication/authentication_script.js');
            handler.default(username, password, req.body, authenticationScriptConfiguration, function (error, user) {
                //console.log(user);
                if (user) {
                    var currentTime = Date.now();
                    var jwtPayload = user;
                    jwtPayload.sub = jwtPayload.id;
                    jwtPayload.aud = client_id;
                    jwtPayload.iss =issuer;
                    jwtPayload.iat = currentTime;
                    jwtPayload.exp = currentTime + cryptoKeys.JWT_EXPIRY_SECONDS; // TODO: make expiration configurable

                    jwt.sign(jwtPayload, cryptoKeys.privateKey, { algorithm: 'RS256' }, function(err, token) {
                        //console.log(err);
                        var params = {
                            response_type: response_type,
                            client_id: client_id,
                            redirect_uri: redirect_uri,
                            state: state,
                            scope: scope,
                            nonce: nonce
                        }
                        if(response_type==='code') {
                            params.code_challenge=req.body.code_challenge;
                            params.code_challenge_method=req.body.code_challenge_method;
                        }
                        var paramsSerial = encodeURIComponent(JSON.stringify(params));
                        var response = 
                            `<form method="post" name="hiddenform" action="${OP_HOST}/postauth/handler">` +
                            `<input type="hidden" name="token" value="${token}">` + 
                            `<input type="hidden" name="params" value="${paramsSerial}">` +
                            '<noscript>\
                                <p>Script is disabled. Click Submit to continue.</p>\
                                <input type="submit" value="Submit">\
                            </noscript>\
                        </form>'
                        //console.log(response)                          
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
    });
                
    return api;
}    