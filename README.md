# easy-oidc-provider - nodejs Easy to setup OpenID Connect Provider
OpenID Connect Provider implementation, configure your OpenID-Connect Provider in few minutes

# Prerequisites
(1) Generate RSA keypair for JWT signing

```bash
#Generates a private key, public key, JWK and stores into "signing-keys-and-certs" directory
./generate_signing_keys_and_certs.sh
```

(2) Setup dynamodb and add tables

```bash
# create dynamodb in AWS and
# create following tables in dynamodb
Table #1 - Authorization codes
Purpose: store authorization code
Name: oidc-authorization-codes
Hash Attribute name: code Type: String
Global Secondary Index (GSI) name: session_id_index, type: session_id

Table #2 - Refresh tokens
Purpose: store refresh tokens
Name: oidc-refresh-tokens
Hash Attribute name: token Type: String
Global Secondary Index (GSI):
Hash Attribute name: refresh_token Type: String
Global Secondary Index (GSI) #1 name: session_id_index, type: session_id
Global Secondary Index (GSI) #2 name: user_id_index, type: user_id

Table #3 - Single sign on session
Purpose: store single sign on session 
Name: oidc-sso-sessions
Global Secondary Index (GSI):
Hash Attribute name: id Type: String
Global Secondary Index (GSI) #2 name: user_id_index, type: user_id

Table #4 - Client credentials
Purpose: Store client_id, client_secret and redirect_uri ( callback urls) 
Name: oidc-client-credentials
Global Secondary Index (GSI):
Hash Attribute name: client_id Type: String
Global Secondary Index (GSI) #2 name: client_name_index, attribute: client_name type: string
```

(3) Update configuration

```bash
# global configuration
path: ./configuration/global_config.json
Add dynamodb (which was created in above prerequisite) endpoints into configuration
configuration/global_config.json
ie.  
    "dynamoDBConfiguration": {
        "endpoint": "ADD_DYNAMODB_ENDPOINT_HERE",
        "region": "AWS_REGION"
    }

# authentication configuration: required, needs to be implemented for user authentication
description: implement user authentication and return authenticated user
required: yes
path: ./configuration/authentication/authentication_script.js
variables: ./configuration/authentication/authentication_script_variables.json - configure variables to be passed in above script

# hooks configuration
required: no, optional if 
description: javascript code to intercept various OIDC phases

a) hook configuration variables
file path: ./configuration/hooks/global_hooks_configuration.json
// add your variables in the below file which are shared in all the hooks
{
    "configuration" : {
        "ADD-KEY-HERE":"ADD-VALUE-HERE"
    }
} 

b) post authenthentication hook : optional
script path: ./configuration/hooks/post_authentication_hook.js - implement your post authentication hook

c) authorization code grant hook : optional
script path: ./configuration/hooks/authorization_code_grant_hook.js - intercept authorization code exchange and add/remove id_token claims

d) refresh token grant hook : optional
script path: ./configuration/hooks/refresh_token_grant_hook.js - intercept refresh_token grant and add/remove id_token claims

e) client credentials grant hook : optional
script path: ./configuration/hooks/client_credentials_grant_hook.js - intercept client_credentials token call and add/remove id_token claims

f) jwt bearer grant hook : optional
script path: ./configuration/hooks/jwt_bearer_grant_hook.js - intercept jwt-bearer grant and add/remove id_token claims
```

# Run service with PM2

```bash
npm install
pm2 start ecosystem.config.js
```

# Run service without PM2

```bash
npm install
node --experimental-modules --experimental-json-modules src/server.mjs
```

# OAuth2/OIDC endpoints

```bash
Authorization endpoint --> http://localhost:8080/oauth2/authorize
Token endpoint --> http://localhost:8080/oauth2/token
Wellknown endpoint --> http://localhost:8080/.well-known/openid-configuration
UserInfo endpoint --> http://localhost:8080/oauth2/userinfo
```

# Client registration APIs to create new client_id/client_secret

```bash
Swagger document - http://localhost:8080/api-docs/#/
Create client   --> POST /api/clients
Get client      -->    GET /api/clients/{id}
Get all clients -->    GET /api/clients
Update client   -->    PATCH /api/clients/{id}
Delete client   -->    DELETE /api/clients/{id}
```

# Integration tests

```bash
npm run integration-tests
```

