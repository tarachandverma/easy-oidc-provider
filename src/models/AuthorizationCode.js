// represents session object read/write in dynamodb as well as sso session cookie
class AuthorizationCode {
  constructor(code, session_id, client_id, user_id, scope, nonce, code_challenge, code_challenge_method) {
    this.code = code;
    this.session_id = session_id;
    this.client_id = client_id;    
    this.user_id = user_id;
    this.scope = scope;
    this.nonce = nonce;
    this.version = '1';    
    this.created_at =  Math.floor(Date.now() / 1000);
    this.code_challenge=code_challenge;
    this.code_challenge_method=code_challenge_method;
  }
}

module.exports = AuthorizationCode;
