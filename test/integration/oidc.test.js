'use strict';

import request from 'supertest';
import should from 'should';
var cheerio = require('cheerio');
const url = require('url');
var setCookie = require('set-cookie-parser');

const app = 'http://localhost:8090';

describe('OIDC API', () => {

    it('returns 200 on wellknown endpoint /.well-known/openid-configuration', (done) => {
        request(app)
            .get('/.well-known/openid-configuration')
            .set('Host', "op.example.org")               
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
            .set('Host', "op.example.org")               
            .expect(function(res) {
                console.log(res.body);
                res.body.should.have.property('keys');
            })
            .expect(200, done);
    });
    
    // authorization code grant: call /oauth2/authorize    
    it('returns 302 to login on authorize code grant API /oauth2/authorize with valid client_id when user not logged-in', (done) => {
        request(app)
            .get('/oauth2/authorize?scope=openid+email+given_name+family_name&client_id=6mE36ZxYhAy84gqSYBK69id4B5uTM4nqHywOyMjk&response_type=code&redirect_uri=http://localhost/callback&state=https%3A%2F%2Fclient.example.com%2F&nonce=44b888fc-74da-490e-93c2-f4e29779f5d8')
            .set('Host', "op.example.org")
            .expect(function(res) {
              console.log(res.header.location);
              res.header.location.should.not.empty();
            })            
            .expect(302, done);
    });

    // login page calling /authenticate API which should returns auto-post HTML which can be POST'ed to /postauth/handler
    var userToken = null;
    it('returns 200 on authenticate API /authenticate when submitted with valid username and password', (done) => {
        var post_body = '{"client_id":"6mE36ZxYhAy84gqSYBK69id4B5uTM4nqHywOyMjk","redirect_uri":"http://localhost/callback","response_type":"code","headers":{"X-REMOTE-USER":"johndoe"},"username":"johndoe","password":"mypassword","scope":"openid email given_name family_name","state":"hKFo2SBhN0xkc19WUG9DWnB0blRfb0lCRFhDc0RMY3JvbGV4TqFupWxvZ2luo3RpZNkgcGJMTjlUdHZHT3h0MHl3UkdFTlVpNTFOWkUycXBmUmSjY2lk2SA1aHNzRUFkTXkwbUpUSUNuSk52QzlUWEV3M1ZhN2pmTw","protocol":"oauth2","nonce":"44b888fc-74da-490e-93c2-f4e29779f5d8","_csrf":"4Tz328WZ-O38twSEL9bhn9wwQ7x4oIiSwRwc"}';
        request(app)
            .post('/authenticate')
            .set('Content-Type', 'application/json')
            .set('Host', "op.example.org")               
            .send(post_body)
            .expect(function(res) {
                console.log(res.text)
                const htmlHandler = cheerio.load(res.text)
                console.log("UserToken:", htmlHandler("form input[name='token']").attr("value"))
                console.log("Context:", htmlHandler("form input[name='ctx']").attr("value")) 
                userToken = htmlHandler("form input[name='token']").attr("value");
            })                                 
            .expect(200, done);
    });
    
    // implicit grant: /postauth/handler should write sso session in browser as well returns to callback url with authorization code
    it('returns 302 with id_token on post authentication handler API /postauth/handler when submitted with valid token and context', (done) => {
        var context = '%7B%22response_type%22%3A%22id_token%22%2C%22client_id%22%3A%226mE36ZxYhAy84gqSYBK69id4B5uTM4nqHywOyMjk%22%2C%22redirect_uri%22%3A%22http%3A//localhost/callback%22%2C%22state%22%3A%2203a09cdc7949a9e2.b61ea4931449b820f1d45c0cbe8760b608b45bb0f8f5645c7204be8e60b711c2%22%2C%22scope%22%3A%22openid+email+given_name+family_name%22%2C%22nonce%22%3A%2244b888fc-74da-490e-93c2-f4e29779f5d8%22%7D';
        request(app)
            .post('/postauth/handler')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('Host', "op.example.org")               
            .send('token=' + userToken + '&ctx=' + context)
            .expect(function(res) {
                console.log(res.body)
                console.log(res.header.location);
                res.header.location.should.not.empty();
            })                      
            .expect(302, done);
    });
    
    // /postauth/handler writes sso-session to browser and authorization code appended to callback url 
    var authorizationCode = null;
    var ssoSession=null;
    it('returns 302 with code on post authentication handler API /postauth/handler when submitted with valid token and context', (done) => {
        var context = '%7B%22response_type%22%3A%22authorization_code%22%2C%22client_id%22%3A%226mE36ZxYhAy84gqSYBK69id4B5uTM4nqHywOyMjk%22%2C%22redirect_uri%22%3A%22http%3A//localhost/callback%22%2C%22state%22%3A%2203a09cdc7949a9e2.b61ea4931449b820f1d45c0cbe8760b608b45bb0f8f5645c7204be8e60b711c2%22%2C%22scope%22%3A%22openid+email+given_name+family_name+offline_access%22%2C%22nonce%22%3A%2244b888fc-74da-490e-93c2-f4e29779f5d8%22%7D';
        request(app)
            .post('/postauth/handler')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('Host', "op.example.org")               
            .send('token=' + userToken + '&ctx=' + context)
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
        var client_id = '6mE36ZxYhAy84gqSYBK69id4B5uTM4nqHywOyMjk', client_secret="ZFy529MtdGu4OFH_LjjIVdqBmd4IBWj7BYNCLMWQbCgeUiTS8Lues0K1vN0z1ElqwmIYj_MdCkuCtalWuDaWzQ";
        var redirect_uri = 'http://localhost/callback';
        request(app)
            .post('/oauth2/token')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('Host', "op.example.org")               
            .send('grant_type=authorization_code&' + 
                '&client_id=' + client_id + '&client_secret='+ client_secret + 
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
        var client_id = '6mE36ZxYhAy84gqSYBK69id4B5uTM4nqHywOyMjk', client_secret="ZFy529MtdGu4OFH_LjjIVdqBmd4IBWj7BYNCLMWQbCgeUiTS8Lues0K1vN0z1ElqwmIYj_MdCkuCtalWuDaWzQ";
        request(app)
            .post('/oauth2/token')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('Host', "op.example.org")               
            .send('grant_type=refresh_token&' + 
                '&client_id=' + client_id + '&client_secret='+ client_secret + 
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
            .get('/oauth2/authorize?scope=openid+email+given_name+family_name&client_id=6mE36ZxYhAy84gqSYBK69id4B5uTM4nqHywOyMjk&response_type=id_token&redirect_uri=http://localhost/callback&state=https%3A%2F%2Fclient.example.com%2F&nonce=44b888fc-74da-490e-93c2-f4e29779f5d8')
            .set('Host', "op.example.org")
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
            .get('/oauth2/authorize?scope=openid+email+given_name+family_name&client_id=6mE36ZxYhAy84gqSYBK69id4B5uTM4nqHywOyMjk&response_type=id_token&redirect_uri=http://localhost/callback&state=https%3A%2F%2Fclient.example.com%2F&nonce=44b888fc-74da-490e-93c2-f4e29779f5d8')
            .set('Host', "op.example.org")
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
        var username = 'johndoes', password = 'mypassword', client_id = '6mE36ZxYhAy84gqSYBK69id4B5uTM4nqHywOyMjk';
        var scope = 'openid+email+given_name+family_name+offline_access';
        request(app)
            .post('/oauth2/token')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('Host', "op.example.org")               
            .send('grant_type=password&'
                +'username=' + username + '&password=' + password 
                + '&client_id=' + client_id + '&scope='+scope)          
            .expect(function(res) {
                console.log(res.body);
                res.body.should.have.property('id_token');
            })
            .expect(200, done);
    });    
    
});