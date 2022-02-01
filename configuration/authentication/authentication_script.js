const request = require('request');
module.exports = async function login (username, password, request_body, configuration, callback) {
    // call your HTTP API and return profile object
    // you can configure variables in authentication_script_variables.json and refer variables using config.AUTHENTICATE_ENDPOINT 
    // example
    var profile = {
      id: '4162b468-6638-3078-b95a-1690252ee3cd',
      given_name: "John",
      family_name: "Doe",
      name: "John Doe",
      email: "John.Doe@example.org",
      email_verified: true
    };
    return callback(null, profile);
}