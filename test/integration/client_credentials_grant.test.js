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
    
    // client_credentials grant: call token endpoint
    it('returns 200 on client_credentials grant API /oauth2/token when submitted with valid client_id and client_secret', (done) => {
        var scope = 'api:myapi';
        request(app)
            .post('/oauth2/token')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('Host', OP_HOST)               
            .send('grant_type=client_credentials&'
                +'client_id=' + CLIENT_ID + '&client_secret=' + CLIENT_SECRET + '&scope='+scope)
            .expect(function(res) {
                console.log(res.body);
                res.body.should.have.property('access_token');
            })
            .expect(200, done);
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