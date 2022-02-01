'use strict';

import request from 'supertest';
import should from 'should';
var cheerio = require('cheerio');
const url = require('url');
var setCookie = require('set-cookie-parser');
const crypto = require("crypto");
const randomstring = require("randomstring");
const base64url = require("base64url");

const app = 'http://localhost:8080';

// read global configuration
const fs = require('fs');
let globalConfigurationRaw = fs.readFileSync('./configuration/global_config.json');
let globalConfiguration = JSON.parse(globalConfigurationRaw);
const OP_HOST = globalConfiguration.wellKnownConfiguration.hosts_supported[0];
console.log(globalConfiguration);

describe('OIDC API', () => {

    var CLIENT_ID = null;
    var CLIENT_SECRET = null;
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
                CLIENT_ID = res.body.client_id;
                res.body.should.have.property('client_secret');
                CLIENT_SECRET = res.body.client_secret
            })            
            .expect(200, done);
    });
    
    // RP calls /oauth2/authorize with PKCE params
    var OP_STATE = null;    
    const CODE_VERIFIER = randomstring.generate(128);
    const base64Digest = crypto.createHash("sha256").update(CODE_VERIFIER).digest("base64");
    console.log(base64Digest);
    const code_challenge = base64url.fromBase64(base64Digest);
    console.log(code_challenge);
    
    it('returns 302 to login on authorize code grant API /oauth2/authorize with valid client_id when user not logged-in', (done) => {
        const SCOPE='openid email given_name family_name offline_access';
        const AUTHORIZE_URL = '/oauth2/authorize?scope='+SCOPE
            +'&client_id='+CLIENT_ID
            +'&response_type=code'
            +'&redirect_uri='+REDIRECT_URI
            +'&state=https%3A%2F%2Fclient.example.com%2F'
            +'&nonce=44b888fc-74da-490e-93c2-f4e29779f5d8'
            +'&code_challenge='+code_challenge
            +'&code_challenge_method=S256'
        console.log("AUTHORIZE_URL: " + AUTHORIZE_URL);
        request(app)
            .get(AUTHORIZE_URL)
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
    
    // authorization code flow
    var userToken2 = null;
    var params2 = null;
    it('returns 200 on authenticate API /authenticate when submitted with valid username and password', (done) => {
        var post_body = {
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            response_type: 'code',
            username: 'john.doe@example.com',
            password: 'dummy',
            scope: 'openid email given_name family_name offline_access',
            state: OP_STATE,
            protocol: 'oauth2',
            nonce: '44b888fc-74da-490e-93c2-f4e29779f5d8',
            code_challenge: code_challenge,
            code_challenge_method: 'S256'
        };
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
    var AUTHORIZATION_CODE = null;
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
              AUTHORIZATION_CODE = queryObject.code
              
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

    // call token endpoint with code_verifier
    var REFRESH_TOKEN = null;
    it('returns 200 on token API /oauth2/token with valid authorization code and client_secret', (done) => {
        var redirect_uri = 'http://localhost/callback';
        request(app)
            .post('/oauth2/token')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('Host', OP_HOST)               
            .send('grant_type=authorization_code&' + 
                '&client_id=' + CLIENT_ID + '&code_verifier='+ CODE_VERIFIER + 
                '&code=' + AUTHORIZATION_CODE + '&redirect_uri=' + redirect_uri)
            .expect(function(res) {
                console.log(res.body);
                res.body.should.have.property('id_token');
                res.body.should.have.property('access_token');
                res.body.should.have.property('refresh_token');
                REFRESH_TOKEN = res.body.refresh_token
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
                '&client_id=' + CLIENT_ID + '&client_secret='+ CLIENT_SECRET + 
                '&refresh_token=' + REFRESH_TOKEN)
            .expect(function(res) {
                console.log(res.body);
                res.body.should.have.property('id_token');
                res.body.should.have.property('access_token');
            })
            .expect(200, done);
    });
    
    // logout with valid session
    it('returns 302 to returnTo url on /logout with session deleted', (done) => {
        const RETURN_TO_URL='http://localhost/sample-page';
        const LEGACY_LOGOUT_URL = '/logout?returnTo='+ RETURN_TO_URL;       
        request(app)
            .get(LEGACY_LOGOUT_URL)
            .set('Host', OP_HOST)
            .set('Cookie', ['session='+ssoSession])
            .expect(function(res) {
                console.log(res.body);
                console.log(res.header);
                res.header.location.should.not.empty();
            })            
            .expect(302, done);
    });
    
    // delete new client credentials using above API_TOKEN
    it('returns a 204 after client is deleted', (done) => {
        console.log("client deleted:", CLIENT_ID);
        request(app)
            .delete('/api/clients/' + CLIENT_ID)
            .set('Host', OP_HOST)            
            .set('Authorization', 'Bearer ' + API_TOKEN)
            .expect(204, done);
    });        
    
});