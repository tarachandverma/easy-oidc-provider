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
             
    // RP calls /oauth2/authorize with response_type=code
    var OP_STATE = null;    
    
/*    it('returns 302 to login on authorize code grant API /oauth2/authorize with valid client_id when user not logged-in', (done) => {
        const SCOPE='openid+idp_id+roles+email+given_name+family_name+djid+djUsername+djStatus+trackid+tags+prts+suuid+createTimestamp';
        const AUTHORIZE_URL = '/oauth2/authorize?scope='+SCOPE
            +'&client_id='+CLIENT_ID
            +'&response_type=code'
            +'&redirect_uri='+REDIRECT_URI
            +'&state=https%3A%2F%2Fclient.example.com%2F'
            +'&nonce=44b888fc-74da-490e-93c2-f4e29779f5d8'
            +'&connection_id=google'
        console.log("AUTHORIZE_URL: " + AUTHORIZE_URL);
        request(app)
            .get(AUTHORIZE_URL)
            .set('Host', OP_HOST)
            .expect(function(res) {
              console.log(res.body);
              console.log(res.header.location);
              res.header.location.should.not.empty();
              // parse location
              const queryObject = url.parse(res.header.location,true).query;
              console.log(queryObject)
              OP_STATE = queryObject.state
            })            
            .expect(302, done);
    });
    
    var ssoSession=null;
    // /postauth/handler writes sso-session to browser based on response coming from external identity provider 
    it('returns 401 for invalid google auth code', (done) => {
        const OP_STATE = 'zCfIG-xF-G7E7LtU.Ug3Jj5zEeqHucpswig-EODAssnOpqadENphIqQ57A7KXlKhuTyiGwDtqy8VXC_F33TNLsDEmkkEwkeTIFR7KUpvrStGcp14HIf6fVOiZvxGm_oupb3fRSrKuk8jsM96IliDybyami4AdkI_edf3x6EjtXfQ7tgXtVVRzjsacc-mSdwifLldXYUeSKu5SlUdptfLXkRRPi2PmkGFGhRp4jlA0zEzDN2eiwuyMW-OkzxJ06KpVoNTN0RCCYoA98eF3DdvvaiRuSTdKXkj2taPgrbT0hmjCIKT01lmt_UYcHQY04dqtVauvXjl1tfz_9fqUTNiizQtIXAQ5jiW_DS8zY5kt-X7YuTpc3X3kQ7qZK-Vo1NZVFl1V0izFEbpN8xj8uIf7YUtJ3R_hkCQCeJoj0KdOgvEEa6Hz80eOwFiylaheNlB1n8w6Nboy-Ms6CTmrioJrdHSZziQWmIIcNBbF1ggSnGeb1Dcs5L-9HCabWSqUJXsqFjQuNbpqA_R_IehcW6J-WrdZo3Fr5CXAUMw6Og';
        const CONNECTION_ID = 'google';
        const GOOGLE_AUTH_CODE = '12345'
        request(app)
            .get('/postauth/handler/' + CONNECTION_ID + '?code=' + GOOGLE_AUTH_CODE)
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('Host', OP_HOST)
            .set('Cookie', ['opstate='+OP_STATE])
            .expect(function(res) {
                console.log(res.body)
            })                      
            .expect(401, done);
    });*/
    
    var ssoSession=null;
    // /postauth/handler writes sso-session to browser based on response coming from external identity provider 
    it('returns 302 when social returns id_token as implicit grant back to OP/postauth/handler/<connection-id>', (done) => {
        const OP_STATE = 'zCfIG-xF-G7E7LtU.Ug3Jj5zEeqHucpswig-EODAssnOpqadENphIqQ57A7KXlKhuTyiGwDtqy8VXC_F33TNLsDEmkkEwkeTIFR7KUpvrStGcp14HIf6fVOiZvxGm_oupb3fRSrKuk8jsM96IliDybyami4AdkI_edf3x6EjtXfQ7tgXtVVRzjsacc-mSdwifLldXYUeSKu5SlUdptfLXkRRPi2PmkGFGhRp4jlA0zEzDN2eiwuyMW-OkzxJ06KpVoNTN0RCCYoA98eF3DdvvaiRuSTdKXkj2taPgrbT0hmjCIKT01lmt_UYcHQY04dqtVauvXjl1tfz_9fqUTNiizQtIXAQ5jiW_DS8zY5kt-X7YuTpc3X3kQ7qZK-Vo1NZVFl1V0izFEbpN8xj8uIf7YUtJ3R_hkCQCeJoj0KdOgvEEa6Hz80eOwFiylaheNlB1n8w6Nboy-Ms6CTmrioJrdHSZziQWmIIcNBbF1ggSnGeb1Dcs5L-9HCabWSqUJXsqFjQuNbpqA_R_IehcW6J-WrdZo3Fr5CXAUMw6Og';
        const CONNECTION_ID = 'google';
        const GOOGLE_ID_TOKEN = 'EXPIRED_GOOGLE_ID_TOKEN'
        request(app)
            .get('/postauth/handler/' + CONNECTION_ID + '?id_token=' + GOOGLE_ID_TOKEN)
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('Host', OP_HOST)
            .set('Cookie', ['opstate='+OP_STATE])
            .expect(function(res) {
                console.log(res.body)
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