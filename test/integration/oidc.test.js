'use strict';

import request from 'supertest';
import should from 'should';
var cheerio = require('cheerio');
const url = require('url');
var setCookie = require('set-cookie-parser');
const crypto = require("crypto");

const app = 'http://localhost:8080';

// read global configuration
const fs = require('fs');
let globalConfigurationRaw = fs.readFileSync('./configuration/global_config.json');
let globalConfiguration = JSON.parse(globalConfigurationRaw);
const OP_HOST = globalConfiguration.wellKnownConfiguration.hosts_supported[0];
console.log(globalConfiguration);

describe('OIDC API', () => {

    var CLIEND_ID = null;
    var CLIEND_SECRET = null;
    var REDIRECT_URI = "http://localhost/callback";
    var API_TOKEN = null;
    // generate API token for Client CRUD APIs
    it('returns 200 on resource owner grant API /oauth2/token when submitted with valid client_id and client_secret', (done) => {
        const client_id = globalConfiguration.clientAPICredentials.client_id;
        const client_secret = globalConfiguration.clientAPICredentials.client_secret;
        const scope='create:client read:client update:client delete:client';
        request(app)
            .post('/oauth2/token')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('Host', OP_HOST)               
            .send('grant_type=client_credentials&'
                +'client_id=' + client_id + '&client_secret=' + client_secret + '&scope='+scope)
            .expect(function(res) {
                console.log(res.body);
                res.body.should.have.property('access_token');
                API_TOKEN = res.body.access_token;
            })
            .expect(200, done);
    });
     
    // generate new client credentials using above API_TOKEN
    it('returns a 200 after new client created', (done) => {
        const randomId = "TestClient" + crypto.randomBytes(8).toString("hex").slice(0, 8);       
        const client = {
            "name": `${randomId}`,
            "callback_urls":[
               REDIRECT_URI
            ],
            "scopes":[
               "api:myapi_1",
               "api:myapi_2"
            ]            
        };
        console.log("client generated:", client);
        request(app)
            .post('/api/clients')
            .set('Host', OP_HOST)            
            .set('Authorization', 'Bearer ' + API_TOKEN)
            .send(client)
            .expect(function(res) {
                console.log(res.body);
                res.body.should.have.property('client_id');
                CLIEND_ID = res.body.client_id;
                res.body.should.have.property('client_secret');
                CLIEND_SECRET = res.body.client_secret
            })            
            .expect(200, done);
    });
    
    it('returns 200 on wellknown endpoint /.well-known/openid-configuration', (done) => {
        request(app)
            .get('/.well-known/openid-configuration')
            .set('Host', OP_HOST)               
            .expect(function(res) {
                console.log(res.body);
                res.body.should.have.property('issuer');
                res.body.should.have.property('authorization_endpoint');
                res.body.should.have.property('token_endpoint');
                res.body.should.have.property('jwks_uri');
                res.body.should.have.property('response_types_supported');
                res.body.should.have.property('claims_supported');
                res.body.should.have.property('grant_types_supported');
            })
            .expect(200, done);
    });
    
    // get OIDC wellknown JWKS endpoint
    it('returns 200 on wellknown JWKS endpoint /.well-known/jwks.json', (done) => {
        request(app)
            .get('/.well-known/jwks.json')
            .set('Host', OP_HOST)               
            .expect(function(res) {
                console.log(res.body);
                res.body.should.have.property('keys');
            })
            .expect(200, done);
    });
    
    // authorization code grant: call /oauth2/authorize
    var OP_STATE = null;    
    it('returns 302 to login on authorize code grant API /oauth2/authorize with valid client_id when user not logged-in', (done) => {
        request(app)
            .get('/oauth2/authorize?scope=openid+email+given_name+family_name&client_id='+CLIEND_ID+'&response_type=code&redirect_uri='+REDIRECT_URI+'&state=https%3A%2F%2Fclient.example.com%2F&nonce=44b888fc-74da-490e-93c2-f4e29779f5d8')
            .set('Host', OP_HOST)
            .expect(function(res) {
              console.log(res.header.location);
              res.header.location.should.not.empty();
              // parse location
              const queryObject = url.parse(res.header.location,true).query;
              console.log(queryObject)
              OP_STATE = queryObject.state
            })            
            .expect(302, done);
    });

    // login page calling /authenticate API which should returns auto-post HTML which can be POST'ed to /postauth/handler
    var userToken1 = null;
    var params1 = null;
    it('returns 200 on authenticate API /authenticate when submitted with valid username and password', (done) => {
        var post_body = '{"client_id":"'+CLIEND_ID+'","redirect_uri":"'+REDIRECT_URI+'","response_type":"id_token","headers":{"X-REMOTE-USER":"johndoe"},"username":"johndoe","password":"mypassword","scope":"openid email given_name family_name offline_access","state":"'+OP_STATE+'","protocol":"oauth2","nonce":"44b888fc-74da-490e-93c2-f4e29779f5d8","_csrf":"4Tz328WZ-O38twSEL9bhn9wwQ7x4oIiSwRwc"}';
        request(app)
            .post('/authenticate')
            .set('Content-Type', 'application/json')
            .set('Host', OP_HOST)               
            .send(post_body)
            .expect(function(res) {
                console.log(res.text)
                const htmlHandler = cheerio.load(res.text)
                console.log("UserToken:", htmlHandler("form input[name='token']").attr("value"))
                console.log("Params:", htmlHandler("form input[name='params']").attr("value")) 
                userToken1 = htmlHandler("form input[name='token']").attr("value");
                params1 = htmlHandler("form input[name='params']").attr("value");
            })                                 
            .expect(200, done);
    });
    
    // implicit grant: /postauth/handler should write sso session in browser as well returns to callback url with authorization code
    it('returns 302 with id_token on post authentication handler API /postauth/handler when submitted with valid token and params', (done) => {
        request(app)
            .post('/postauth/handler')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('Host', OP_HOST)               
            .send('token=' + userToken1 + '&params=' + params1)
            .expect(function(res) {
                console.log(res.body)
                console.log(res.header.location);
                res.header.location.should.not.empty();
            })                      
            .expect(302, done);
    });
    
    // authorization code flow
    var userToken2 = null;
    var params2 = null;
    it('returns 200 on authenticate API /authenticate when submitted with valid username and password', (done) => {
        var post_body = '{"client_id":"'+CLIEND_ID+'","redirect_uri":"'+REDIRECT_URI+'","response_type":"code","headers":{"X-REMOTE-USER":"johndoe"},"username":"johndoe","password":"mypassword","scope":"openid email given_name family_name offline_access","state":"'+OP_STATE+'","protocol":"oauth2","nonce":"44b888fc-74da-490e-93c2-f4e29779f5d8","_csrf":"4Tz328WZ-O38twSEL9bhn9wwQ7x4oIiSwRwc"}';
        request(app)
            .post('/authenticate')
            .set('Content-Type', 'application/json')
            .set('Host', OP_HOST)               
            .send(post_body)
            .expect(function(res) {
                console.log(res.text)
                const htmlHandler = cheerio.load(res.text)
                console.log("UserToken:", htmlHandler("form input[name='token']").attr("value"))
                console.log("Params:", htmlHandler("form input[name='params']").attr("value")) 
                userToken2 = htmlHandler("form input[name='token']").attr("value");
                params2 = htmlHandler("form input[name='params']").attr("value");
            })                                 
            .expect(200, done);
    });
        
    // /postauth/handler writes sso-session to browser and authorization code appended to callback url 
    var authorizationCode = null;
    var ssoSession=null;
    it('returns 302 with code on post authentication handler API /postauth/handler when submitted with valid token and params', (done) => {
        request(app)
            .post('/postauth/handler')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('Host', OP_HOST)               
            .send('token=' + userToken2 + '&params=' + params2)
            .expect(function(res) {
              console.log(res.header.location);
              res.header.location.should.not.empty();
              // parse location
              const queryObject = url.parse(res.header.location,true).query;
              console.log(queryObject)
              authorizationCode = queryObject.code
              
              console.log(res.headers);
               // extract session from response header "set-cookie"
                  var cookies = setCookie.parse(res, {
                    decodeValues: true,  // default: true
                    map: true           //default: false
                  });
                
                  var sessionCookie = cookies['session'];
                  console.log(sessionCookie);
                  ssoSession = sessionCookie.value              
            })                      
            .expect(302, done);
    });

    // authorization code grant: call token endpoint
    var refreshToken = null;
    it('returns 200 on token API /oauth2/token with valid authorization code and client_secret', (done) => {
        var redirect_uri = 'http://localhost/callback';
        request(app)
            .post('/oauth2/token')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('Host', OP_HOST)               
            .send('grant_type=authorization_code&' + 
                '&client_id=' + CLIEND_ID + '&client_secret='+ CLIEND_SECRET + 
                '&code=' + authorizationCode + '&redirect_uri=' + redirect_uri)
            .expect(function(res) {
                console.log(res.body);
                res.body.should.have.property('id_token');
                res.body.should.have.property('access_token');
                res.body.should.have.property('refresh_token');
                refreshToken = res.body.refresh_token
            })
            .expect(200, done);
    });
    
    // refresh token grant: call token endpoint
    it('returns 200 on token API /oauth2/token with valid authorization code and client_secret', (done) => {
        request(app)
            .post('/oauth2/token')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('Host', OP_HOST)               
            .send('grant_type=refresh_token&' + 
                '&client_id=' + CLIEND_ID + '&client_secret='+ CLIEND_SECRET + 
                '&refresh_token=' + refreshToken)
            .expect(function(res) {
                console.log(res.body);
                res.body.should.have.property('id_token');
                res.body.should.have.property('access_token');
            })
            .expect(200, done);
    });
    
    // implicit code grant: call /oauth2/authorize with valid browser session
    it('returns 302 to callback url on /oauth2/authorize implicit grant API /oauth2/authorize with valid client_id but invalid/expired browser logged-in session', (done) => {
        request(app)
            .get('/oauth2/authorize?scope=openid+email+given_name+family_name&'+'client_id='+CLIEND_ID+'&response_type=id_token&redirect_uri=http://localhost/callback&state=https%3A%2F%2Fclient.example.com%2F&nonce=44b888fc-74da-490e-93c2-f4e29779f5d8')
            .set('Host', OP_HOST)
            .set('Cookie', ['sso_session='+ssoSession])
            .expect(function(res) {
                console.log(res.body);
                console.log(res.header.location);
                res.header.location.should.not.empty();
            })            
            .expect(302, done);
    });
        
    // implicit code grant: call /oauth2/authorize with invalid browser session        
    it('returns 302 to login page on /oauth2/authorize code grant API /oauth2/authorize with valid client_id but invalid browser logged-in session', (done) => {    
        request(app)
            .get('/oauth2/authorize?scope=openid+email+given_name+family_name&'+'client_id='+CLIEND_ID+'&response_type=id_token&redirect_uri=http://localhost/callback&state=https%3A%2F%2Fclient.example.com%2F&nonce=44b888fc-74da-490e-93c2-f4e29779f5d8')
            .set('Host', OP_HOST)
            .set('Cookie', ['sso_session=INVALID_SESSION'])
            .expect(function(res) {
                console.log(res.body);
                console.log(res.header.location);
                res.header.location.should.not.empty();
            })            
            .expect(302, done);
    });
    
    // resource-owner password grant: call token endpoint
    it('returns 200 on resource owner grant API /oauth2/token when submitted with valid username and password', (done) => {
        var username = 'johndoes', password = 'mypassword';
        var scope = 'openid+email+given_name+family_name+offline_access';
        request(app)
            .post('/oauth2/token')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('Host', OP_HOST)               
            .send('grant_type=password&'
                +'username=' + username + '&password=' + password 
                + '&client_id=' + CLIEND_ID + '&scope='+scope)          
            .expect(function(res) {
                console.log(res.body);
                res.body.should.have.property('id_token');
            })
            .expect(200, done);
    });
    
    // client_credentials grant: call token endpoint
    it('returns 200 on client_credentials grant API /oauth2/token when submitted with valid client_id and client_secret', (done) => {
        var scope = 'api:myapi';
        request(app)
            .post('/oauth2/token')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('Host', OP_HOST)               
            .send('grant_type=client_credentials&'
                +'client_id=' + CLIEND_ID + '&client_secret=' + CLIEND_SECRET + '&scope='+scope)
            .expect(function(res) {
                console.log(res.body);
                res.body.should.have.property('access_token');
            })
            .expect(200, done);
    });  
    
});