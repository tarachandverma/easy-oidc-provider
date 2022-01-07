import authenticationScriptConfiguration from '../configuration/authentication/authentication_script_variables.json'
import postAuthenticationConfiguration from '../configuration/hooks/post_authentication_hook_configuration.json'
import globalConfiguration from '../configuration/global_config.json'
import { readFileSync } from 'fs'
import Authorize from './oidc/Authorize.js'
import express from 'express'
import AWS from 'aws-sdk';
import Authenticate from './oidc/Authenticate.js';
import PostAuthenticationHandler from './oidc/PostAuthenticationHandler.js';
import OAuthToken from './oidc/OAuthToken.js';
import WellKnownDiscoveryDocument from './oidc/WellKnownDiscoveryDocument.js'
import APIs from './api/APIs.js';
import cookieParser from 'cookie-parser';
import jwksJson from '../signing-keys-and-certs/jwks.json';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './swagger.json';

const app = express()

app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded 
app.use(cookieParser());

// load keys
var privateKey = readFileSync('./signing-keys-and-certs/private.pem');
var publicKey = readFileSync('./signing-keys-and-certs/public.pem');

// TODO: all of these keys must come from Vault per environment. PROD should not share any keys
var cryptoKeys = {
    privateKey: privateKey,
    publicKey: publicKey,
    jwksJson: jwksJson,
    stateEncryptionKey: globalConfiguration.stateEncryptionKey,
    codeEncryptionKey: globalConfiguration.codeEncryptionKey,
    JWT_EXPIRY_SECONDS: globalConfiguration.jwtExpirySeconds
}

// initialize dynamodb
const aws_dynamodb_endpoint = globalConfiguration.dynamoDBConfiguration.endpoint || 'http://localhost:8000';
const aws_region = globalConfiguration.dynamoDBConfiguration.region;
process.env.AWS_NODEJS_CONNECTION_REUSE_ENABLED=1;
let awsConfigurationOptions = {
  region: aws_region,
  maxRetries: 3
};

awsConfigurationOptions.endpoint = aws_dynamodb_endpoint;
//console.log(config.db.aws_dynamodb_endpoint);
if (awsConfigurationOptions.endpoint.includes("localhost")) { // local dynamodb
    awsConfigurationOptions.accessKeyId = 'dummy';
    awsConfigurationOptions.secretAccessKey = 'dummy';
}
AWS.config.update(awsConfigurationOptions);
var docClient = new AWS.DynamoDB.DocumentClient();

// authorize which validates client_id and other authentication request params
app.use('/.well-known', WellKnownDiscoveryDocument({ globalConfiguration, cryptoKeys }));

// authorize which validates client_id and other authentication request params
app.use('/oauth2/authorize', Authorize({ docClient, globalConfiguration, cryptoKeys, postAuthenticationConfiguration }));

// authentication handler which executes login script
app.use('/authenticate', Authenticate({ docClient, globalConfiguration, cryptoKeys, authenticationScriptConfiguration }));

// post auth handler where post_authentication_hook is executed
app.use('/postauth/handler', PostAuthenticationHandler({ docClient, globalConfiguration, cryptoKeys, postAuthenticationConfiguration }));

// token API
app.use('/oauth2/token', OAuthToken({ docClient, globalConfiguration, cryptoKeys, authenticationScriptConfiguration, postAuthenticationConfiguration }));

// swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
        
// client credentials API
app.use('/api', APIs({ docClient, globalConfiguration, cryptoKeys }));

// health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: "OK" });
});
    
app.listen(8090, () => console.log('OpenID-Connect server listening on port 8090!'))