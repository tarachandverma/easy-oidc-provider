# easy-oidc-provider - nodejs Easy to setup OpenID Connect Provider
OpenID Connect Provider implementation, configure your OpenID-Connect Provider in few minutes

# Prerequisites
(1) Generate RSA keypair for JWT signing

```bash
Generate a private key, and store it in a file called private.pem
cd signing-keys-and-certs
openssl genrsa -des3 -passout pass:SomePassword -out private.pass.pem 2048
openssl rsa -passin pass:SomePassword -in private.pass.pem -out private.pem

Note: You can delete the private.pass.pem file because you no longer need it.
rm -rf private.pass.pem

# generate self-signed certificate signing request
openssl req -new -key private.pem -out server.csr

Country Name=US
State=YOUR_STATE
City=YOUR_CITY
Company=YOUR_COMPANY
Organizational Unit Name=SKIP
Common Nmae=op.example.org
Email Address: YOUR_EMAIL_ADDRESS@example.com
A challenge password=WHATEVER_YOU_WANT

# generate self-signed certificate valid for 10 years
openssl x509 -req -sha256 -days 3650 -in server.csr -signkey private.pem -out server.crt

# generate public key from above certificate
openssl x509 -in server.crt -pubkey -out public.pem

# calculate finger print
openssl x509 -in public.pem -noout -fingerprint

#generate public key (required form JWK generation )
openssl rsa -in private.pem -out public.pem -pubout

# convert PEM to JWK
visit https://8gwifi.org/jwkconvertfunctions.jsp or https://irrte.ch/jwt-js-decode/pem2jwk.html 
and select "PEM-to-JWK (RSA Only)" and paste above public key (public.pem) in Input
and hit submit, you'll see JWK formatted public key
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
# authentication script
configuration/authentication/authentication_script.js - implement your authentication call
configuration/authentication/authentication_script_variables.json - configure variables to be passed in above script

# hooks - javascript code to intercept variable phases of OIDC authentication flow
a) post authenthentication hook
configuration/hooks/post_authentication_hook.js - implement your authentication call
configuration/hooks/post_authentication_hook_configuration.json - configure variables to be passed in above script

b) authorization code grant hook
configuration/hooks/post_authentication_hook.js - implement your authentication call
configuration/hooks/post_authentication_hook_configuration.json - configure variables to be passed in above script

c) refresh token grant hook
configuration/hooks/refresh_token_grant_hook.js - implement your authentication call
configuration/hooks/refresh_token_grant_hook_configuration.json - configure variables to be passed in above script

d) client credentials grant hook
configuration/hooks/client_credentials_grant_hook.js - implement your authentication call
configuration/hooks/client_credentials_grant_hook_configuration.json - configure variables to be passed in above script

d) jwt bearer grant hook
configuration/hooks/jwt_bearer_grant_hook.js - implement your authentication call
configuration/hooks/jwt_bearer_grant_hook_configuration.json - configure variables to be passed in above script

e) Add dynamodb (which was created in above prerequisite) endpoints into configuration
configuration/global_config.json
ie.  
    "dynamoDBConfiguration": {
        "endpoint": "ADD_DYNAMODB_ENDPOINT_HERE",
        "region": "AWS_REGION"
    }
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
Authorization endpoint --> http://localhost:8090/oauth2/authorize
Token endpoint --> http://localhost:8090/oauth2/token
Wellknown endpoint --> http://localhost:8090/.well-known/openid-configuration
```

# Client registration APIs to create new client_id/client_secret

```bash
Swagger document - http://localhost:8090/api-docs/#/
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

