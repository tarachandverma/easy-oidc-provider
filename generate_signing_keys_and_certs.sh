#!/bin/bash
#Generate a private key, and store it in a file called private.pem
mkdir signing-keys-and-certs
cd signing-keys-and-certs
openssl genrsa -des3 -passout pass:SomePassword -out private.pass.pem 2048
openssl rsa -passin pass:SomePassword -in private.pass.pem -out private.pem

#Note: delete the private.pass.pem file because you no longer need it.
rm -rf private.pass.pem

# generate self-signed certificate signing request
openssl req -subj '/C=US/ST=YOUR_STATE/L=YOUR_CITY/O=YOUR_COMPANY/CN=YOUR_OP_HOST_DOMAIN' -new -key private.pem -out server.csr

# generate self-signed certificate valid for 10 years
openssl x509 -req -sha256 -days 3650 -in server.csr -signkey private.pem -out server.crt

# generate public key from above certificate
openssl x509 -in server.crt -pubkey -out public.pem

# calculate finger print
openssl x509 -in public.pem -noout -fingerprint

# convert PEM to JWK
npm install -g pem-jwk
cat private.pem | pem-jwk > private_jwk.json