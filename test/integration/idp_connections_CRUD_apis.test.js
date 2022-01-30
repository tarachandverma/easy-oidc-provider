'use strict';

import request from 'supertest';
import should from 'should';
const crypto = require("crypto");

const app = 'http://localhost:8080';

const fs = require('fs');
let globalConfigurationRaw = fs.readFileSync('./configuration/global_config.json');
let globalConfiguration = JSON.parse(globalConfigurationRaw);
const OP_HOST = globalConfiguration.wellKnownConfiguration.hosts_supported[0];
console.log(globalConfiguration);

describe('OIDC API', () => {

    var IDP_CONNECTION_ID = null;
    var API_TOKEN = null;
    // generate API token for Identity Provider connections CRUD APIs
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
     
    // store new identity provider connections using above API_TOKEN
    it('returns a 201 after new idpConnection created', (done) => {
        const randomId = "TestIdp" + crypto.randomBytes(8).toString("hex").slice(0, 8);       
        const idpConnection = {
            "name": `${randomId}`,
            "id": `${randomId}`,
            "protocol": "oauth2",
            "oauth2_protocol_settings": {
            "issuer": "https://accounts.google.com",
            "wellknown_endpoint": "https://accounts.google.com/.well-known/openid-configuration",
            "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
            "token_endpoint": "https://oauth2.googleapis.com/token",
            "userinfo_endpoint": "https://openidconnect.googleapis.com/v1/userinfo",
            "jwks_uri": "https://www.googleapis.com/oauth2/v3/certs"
          },
          "oauth2_relying_party_settings": {
            "client_id": "GOOGLE_CLIENT_ID",
            "client_secret": "ANYTHING_FOR_NOW",
            "client_secret_signing_key": null,
            "scopes_requested": "basic_profile+extended_profile",
            "apple_team_id": null,
            "apple_key_id": null
          }
        };
        console.log("IdPConnection stored:", idpConnection);
        request(app)
            .post('/api/idp_connections')
            .set('Host', OP_HOST)            
            .set('Authorization', 'Bearer ' + API_TOKEN)
            .send(idpConnection)
            .expect(function(res) {
                console.log(res.location);
                IDP_CONNECTION_ID = idpConnection.id;
            })            
            .expect(201, done);
    });

    // store new identity provider connections using above API_TOKEN
    it('returns a 201 after new google connection created', (done) => {
        const idpConnection = {
          "id": "google",
          "name": "google oauth2 connection",
          "protocol": "oauth2",
          "oauth2_protocol_settings": {
            "issuer": "https://accounts.google.com",
            "wellknown_endpoint": "https://accounts.google.com/.well-known/openid-configuration",
            "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
            "token_endpoint": "https://oauth2.googleapis.com/token",
            "userinfo_endpoint": "https://openidconnect.googleapis.com/v1/userinfo",
            "jwks_uri": "https://www.googleapis.com/oauth2/v3/certs"
          },
          "oauth2_relying_party_settings": {
            "client_id": "GOOGLE_CLIENT_ID",
            "client_secret": "GOOGLE_CLIENT_SECRET",
            "client_secret_signing_key": null,
            "scopes_requested": "basic_profile+extended_profile",
            "apple_team_id": null,
            "apple_key_id": null
          }
        };
        console.log("IdPConnection stored:", idpConnection);
        request(app)
            .post('/api/idp_connections')
            .set('Host', OP_HOST)            
            .set('Authorization', 'Bearer ' + API_TOKEN)
            .send(idpConnection)
            .expect(function(res) {
                console.log(res.body);                
                console.log(res.location);
            })            
            .expect(201, done);
    });
        
    // get idp connection using above API_TOKEN
    it('returns a 200 with IdPConnection data', (done) => {
        console.log("IdPConnection retrieved:", IDP_CONNECTION_ID);
        request(app)
            .get('/api/idp_connections/' + IDP_CONNECTION_ID)
            .set('Host', OP_HOST)            
            .set('Authorization', 'Bearer ' + API_TOKEN)
            .expect(function(res) {
                console.log(res.body);
            })            
            .expect(200, done);
    });
        
    // updates new identity provider connections using above API_TOKEN
    it('returns a 204 after idpConnection is updated', (done) => {
        const randomId = "TestIdp" + crypto.randomBytes(8).toString("hex").slice(0, 8);       
        const idpConnection = {
            "name": `${randomId}`
        };
        console.log("IdPConnection stored:", idpConnection);
        request(app)
            .patch('/api/idp_connections/' + IDP_CONNECTION_ID)
            .set('Host', OP_HOST)            
            .set('Authorization', 'Bearer ' + API_TOKEN)
            .send(idpConnection)
            .expect(function(res) {
                console.log(res.body);
            })            
            .expect(204, done);
    });
        
    // delete idp connection using above API_TOKEN
    it('returns a 204 after IdPConnection is deleted', (done) => {
        console.log("IdPConnection deleted:", IDP_CONNECTION_ID);
        request(app)
            .delete('/api/idp_connections/' + IDP_CONNECTION_ID)
            .set('Host', OP_HOST)            
            .set('Authorization', 'Bearer ' + API_TOKEN)
            .expect(204, done);
    });    
    
});