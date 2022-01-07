const request = require('request');
module.exports = async function (user, context, configuration, callback) {
    // TODO: add/remove claims to user as well as generate redirect during the login process
    // you can make HTTP call to your backend API using 'request' module as well
    return callback(null, user, context);
}