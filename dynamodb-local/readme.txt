# Start docker container, it will start dynamodb at http://localhost:8000
docker-compose up

# open another tab install dynamodb Admin UI
npm install -g dynamodb-admin

# start dynamodb Admin UI
export DYNAMO_ENDPOINT="http://localhost:8000"
dynamodb-admin 

# To access admin UI, type http://localhost:8001/ on the browser 
http://localhost:8001

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