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

const fs = require('fs');
let globalConfigurationRaw = fs.readFileSync('./configuration/global_config.json');
let globalConfiguration = JSON.parse(globalConfigurationRaw);
const OP_HOST = globalConfiguration.wellKnownConfiguration.hosts_supported[0];
console.log(globalConfiguration);

describe('OIDC API', () => {

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
    
});