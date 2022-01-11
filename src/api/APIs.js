const Router  =  require('express').Router;
const utils  =  require('../lib/util');
const Clients = require('../api/Clients');
const ErrorHandler = require('../lib/ErrorHandler');
const SingletonClientCredentialsCache = require('../client_credentials_cache');
const expressJwt = require('express-jwt');

function validateAPIToken(globalConfiguration, cryptoKeys) {
    const getPublicKey = function (req, payload, done) {
        //console.log(payload);
        if(!payload) {
            return done(new Error('UnauthorizedError', 'Invalid token.'));
        }
        const jwtIssuer = payload.iss;
        var currentIssuer = "https://" + globalConfiguration.wellKnownConfiguration.host + "/";
        if(!jwtIssuer || !currentIssuer || jwtIssuer !== currentIssuer) {
            return done(new Error('UnauthorizedError', 'Invalid issuer.'));
        }
        
        done(null, cryptoKeys.publicKey);
    };
    return expressJwt({ secret: getPublicKey, algorithms: ['RS256']  });
};


module.exports = ({ docClient, globalConfiguration, cryptoKeys }) => {
    // periodically fetch and cache all client credentials
    //var cron = require('node-cron');
    //function updateClientCredentialsCacheCallback(){
    //    console.log('periodically fetch and cache client credentials every 30 minutes');        
    //    const cache =  SingletonClientCredentialsCache.getInstance().cache;
    //    // TODO: scan docClient and populate cache
    //    var client = null;
    //    if (client && cache) {
    //        client.cached_at = Date.now();
    //        //let success = cache.set( client.client_id, client, 86400); // cache it for 24 hrs
    //    }        
    //}
    //updateClientCredentialsCacheCallback(); //immediate execution for initial load of client credentials
    //var cronJob = cron.schedule('*/30 * * * *', updateClientCredentialsCacheCallback, false) //periodically execution. First after 30 minutes. 
    //cronJob.start();
        
    let api = Router();
    
    api.use('/clients', validateAPIToken(globalConfiguration, cryptoKeys), Clients({ docClient, globalConfiguration }));

    // error handler    
    api.use(ErrorHandler);
                    
    return api;
}     