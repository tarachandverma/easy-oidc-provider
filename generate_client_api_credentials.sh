#!/bin/bash
#Generate client credentials for ClientAPIs to retrieve API access_token
CLIENT_CRUD_API_CLIENT_ID=$(cat /dev/urandom | env LC_CTYPE=C tr -dc 'a-zA-Z0-9' | fold -w 42 | head -n 1)
CLIENT_CRUD_API_CLIENT_SECRET=$(cat /dev/urandom | env LC_CTYPE=C tr -dc 'a-zA-Z0-9' | fold -w 84 | head -n 1)
echo "CLIENT_CRUD_API_CLIENT_ID: $CLIENT_CRUD_API_CLIENT_ID"
echo "CLIENT_CRUD_API_CLIENT_SECRET: $CLIENT_CRUD_API_CLIENT_SECRET"