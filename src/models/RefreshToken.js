// represents RefreshToken object read/write in dynamodb as well as sso session cookie
class RefreshToken {
  constructor(token, session_id, client_id, subject, scope, nonce) {
    this.token = token;
    this.session_id = session_id;
    this.client_id = client_id;    
    this.subject = subject;
    this.scope = scope;
    this.nonce = nonce;
    this.version = '1';    
    this.created_at =  Math.floor(Date.now() / 1000);
  }
}

module.exports = RefreshToken;
