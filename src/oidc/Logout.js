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
        //console.log(queryObject)
        
        // validate client_id
        if (queryObject.returnTo == null){
            return utils.sendErrorResponse(res, null, 'invalid_request', 'returnTo url missing');
        }
                
        let cookie = req.cookies['session'];
        if(cookie) {
            const delete_params = {
                TableName : globalConfiguration.dynamoDBTablesNames.ssoSession,
                Key:{
                    "id": cookie
                }         
            }            
            docClient.delete(delete_params, function(err, data) {
                // ignore dynamodb error, just return to callback url
                res.clearCookie('session');
                res.writeHead(302, {
                  location: decodeURIComponent(queryObject.returnTo)
                });
                return res.end();                    
            });
        }else{
            res.writeHead(302, {
              location: decodeURIComponent(queryObject.returnTo)
            });
            return res.end();            
        }
    });
                
    return api;
}