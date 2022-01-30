const request = require('request');
module.exports = async function (user, params, configuration, callback) {
  if((false/*some condition to set redirect here*/)) {
    // set some response headers during the login from including a redirect via location here
    var anyRedirectUrl = 'https://your-domain.com/redirector';
    params.response_headers = params.response_headers || [];
    if(params.request.query.prompt !== 'none') {
        params.response_headers.push({name: 'location', value: anyRedirectUrl});
    }
    //console.log(params.response_headers);
  }
  callback(null, user, params);
}