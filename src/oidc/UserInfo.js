const Router  =  require('express').Router;
var jwt = require('jsonwebtoken')

module.exports = ({ globalConfiguration, cryptoKeys }) => {
    let api = Router();

    api.get('/', async (req, res) => {
        //console.log(req.body);
        var accessToken = req.query.access_token;
    
        var user = null;    
        try {
            const decoded = jwt.verify(accessToken, cryptoKeys.publicKey, { algorithms: ['RS256']});
            user = decoded;
        }
        catch (ex) { console.log(ex.message); }
        console.log(user);
                
        var response = {
            "sub": user !=null ? user.sub : null
        }
        res.status(200).json(response);
    });
                
    return api;
}