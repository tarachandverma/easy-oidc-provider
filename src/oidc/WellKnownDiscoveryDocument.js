const Router  =  require('express').Router;
const utils  =  require('../lib/util');
module.exports = ({ globalConfiguration, cryptoKeys }) => {
    let api = Router();

    api.get('/openid-configuration', async (req, res) => {
        const CURRENT_HOST =  utils.getCurrentOPHttpProtocol(req) + "://" + utils.getCurrentOPHost(req, globalConfiguration.wellKnownConfiguration.hosts_supported);
        var response = {
            "issuer": CURRENT_HOST + "/",
            "authorization_endpoint": CURRENT_HOST + "/oauth2/authorize",
            "token_endpoint": CURRENT_HOST + "/oauth2/token",
            "userinfo_endpoint": CURRENT_HOST + "/oauth2/userinfo",
            "jwks_uri": CURRENT_HOST + "/.well-known/jwks.json",
            "scopes_supported": globalConfiguration.wellKnownConfiguration.scopes_supported,
            "response_types_supported": globalConfiguration.wellKnownConfiguration.response_types_supported,
            "id_token_signing_alg_values_supported": globalConfiguration.wellKnownConfiguration.id_token_signing_alg_values_supported,
            "claims_supported": globalConfiguration.wellKnownConfiguration.claims_supported,
            "grant_types_supported": globalConfiguration.wellKnownConfiguration.grant_types_supported                                                            
        }
        res.status(200).json(response);
    });
    
    api.get('/jwks.json', async (req, res) => {
        res.status(200).json(cryptoKeys.jwksJson);
    });
                
    return api;
}