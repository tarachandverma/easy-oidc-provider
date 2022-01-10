# easy-oidc-provider - easy to setup OpenID Connect Provider
OpenID Connect Provider implementation, configure your OpenID-Connect Provider in few minutes

# Prerequisites
(1) Generate RSA keypair for JWT signing (required)

```bash
#Generates a private key, public key, JWK and stores into "signing-keys-and-certs" directory
./generate_signing_keys_and_certs.sh
```

(2) Generate encryption keys for authorization code and state (required)

```bash
# run following command
./generate_code_and_state_encryption_keys.sh
# open global_config.json in editor and copy STATE_ENCRYPTION_KEY and STATE_ENCRYPTION_KEY
# ./configuration/global_config.json
    "stateEncryptionKey": "STATE_ENCRYPTION_KEY",
    "codeEncryptionKey": "STATE_ENCRYPTION_KEY", 
```

(3) Generate master client_id, client_secret to call client credentials CRUD APIs (required)

```bash
# run following command
./generate_client_api_credentials.sh
# open global_config.json in editor and copy CLIENT_CRUD_API_CLIENT_ID and CLIENT_CRUD_API_CLIENT_SECRET
# ./configuration/global_config.json
    "clientAPICredentials": {
        "client_id": "CLIENT_CRUD_API_CLIENT_ID",
        "client_secret": "CLIENT_CRUD_API_CLIENT_SECRET"
    } 
```

(4) Setup dynamodb and add tables (required)

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

(5) Add dynamodb configuration (required)

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
```

(6) Configure authentication script (required)

```bash
# authentication configuration: required, needs to be implemented for user authentication
description: implement user authentication and return authenticated user
required: yes
path: ./configuration/authentication/authentication_script.js
variables: ./configuration/authentication/authentication_script_variables.json - configure variables to be passed in above script
```

(7) Configure grant type hooks (optional)

```bash
# hooks configuration
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

(8) Update Login page (optional)

```bash
# login page
path: ./configuration/login-page/login.html
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
Authorization endpoint --> /oauth2/authorize
Token endpoint --> /oauth2/token
Wellknown endpoint --> /.well-known/openid-configuration
UserInfo endpoint --> /oauth2/userinfo
```

# OAuth2/OIDC flow

```bash
RP 
302 --> https://op.example.org/oauth2/authorize?scope=SCOPE&client_id=CLIENT_ID&response_type=RESPONSE_TYPE&redirect_uri=RP_CALLBACK_URL&nonce=RP_GENERATED_NONCE&state=RP_GENERATED_STATE
302 --> https://op.example.org/login-page?scope=SCOPE&client_id=CLIENT_ID&response_type=RESPONSE_TYPE&redirect_uri=RP_CALLBACK_URL&nonce=RP_GENERATED_NONCE&state=OP_STATE
[user submits username and password ]
--> POST: https://op.example.org/authenticate
[username=&password=&scope=client_id=&response_type=&redirect_uri=&nonce=&state=]
--> POST: https://op.example.org/postauth/handler
302 --> RP_CALLBACK_URL?code=&state=
...
GET RP_CALLBACK_URL?code=&state=
[POST: https://op.example.org/oauth2/token
 body: code=&redirect_uri=&client_id=&client_secret=
 retrieve id_token
 RP consumes id_token as necesary
]
```

# Client registration APIs to create new client_id/client_secret

```bash
# get master client_id and client_secret from step#5 of prerequisites from
./configuration/global_config.json
    
# Generate access token
curl --request POST \
  --url 'https://localhost:8080/oauth2/token' \
  --header 'content-type: application/x-www-form-urlencoded' \
  --data 'grant_type=client_credentials&client_id=MASTER_CLIENT_ID&client_secret=MASTER_CLIENT_SECRET&scope=create:client read:client update:client delete:client'
# response
{
    access_token=API_ACCESS_TOKEN
}  
 
```

```bash
Swagger document - http://localhost:8080/api-docs/#/
# use above swagger url with above API_ACCESS_TOKEN to create new client credentials
Create client   -->    POST /api/clients
Get client      -->    GET /api/clients/{id}
Get all clients -->    GET /api/clients
Update client   -->    PATCH /api/clients/{id}
Delete client   -->    DELETE /api/clients/{id}
```

# Integration tests

```bash
npm run integration-tests
```

