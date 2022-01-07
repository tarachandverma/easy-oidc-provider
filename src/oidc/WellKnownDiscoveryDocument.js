const Router  =  require('express').Router;

module.exports = ({ globalConfiguration, cryptoKeys }) => {
    let api = Router();

    api.get('/openid-configuration', async (req, res) => {
        // TODO: implement jwks publishing endpoint
        // this is dummy keys, we need to generate real keys and add it here
        var response = {
            "issuer": "https://" + globalConfiguration.wellKnownConfiguration.host + "/",
            "authorization_endpoint": "https://" + globalConfiguration.wellKnownConfiguration.host + "/oauth2/authorize",
            "token_endpoint": "https://" + globalConfiguration.wellKnownConfiguration.host + "/oauth2/token",
            "userinfo_endpoint": "https://" + globalConfiguration.wellKnownConfiguration.host + "/oauth2/userinfo",
            "jwks_uri": "https://" + globalConfiguration.wellKnownConfiguration.host + "/.well-known/jwks.json",
            "scopes_supported": globalConfiguration.wellKnownConfiguration.scopes_supported,
            "response_types_supported": globalConfiguration.wellKnownConfiguration.response_types_supported,
            "id_token_signing_alg_values_supported": globalConfiguration.wellKnownConfiguration.id_token_signing_alg_values_supported,
            "claims_supported": globalConfiguration.wellKnownConfiguration.claims_supported,
            "grant_types_supported": globalConfiguration.wellKnownConfiguration.grant_types_supported                                                            
        }
        res.status(200).json(response);
    });
    
    api.get('/jwks.json', async (req, res) => {
        // TODO: implement jwks publishing endpoint
        // this is dummy keys, we need to generate real keys and add it here
        res.status(200).json(cryptoKeys.jwksJson);
    });
                
    return api;
}