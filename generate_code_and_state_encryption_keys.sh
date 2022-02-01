#!/bin/bash
#Generate state and code encryption keys
STATE_ENCRYPTION_KEY=$(cat /dev/urandom | env LC_CTYPE=C tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
CODE_ENCRYPTION_KEY=$(cat /dev/urandom | env LC_CTYPE=C tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
echo "STATE_ENCRYPTION_KEY: $STATE_ENCRYPTION_KEY"
echo "CODE_ENCRYPTION_KEY: $CODE_ENCRYPTION_KEY"