const Router  =  require('express').Router;
const fs = require('fs');
module.exports = ({ globalConfiguration, cryptoKeys }) => {
    let api = Router();

    api.get('/', async (req, res) => {
        fs.readFile('./configuration/login-page/login.html', function (err, html) {
            if (err) {
                throw err; 
            }       
            res.writeHeader(200, {"Content-Type": "text/html"});  
            res.write(html);  
            res.end();  
        });
    });

    return api;
}