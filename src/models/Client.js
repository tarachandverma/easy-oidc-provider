// represents session object read/write in dynamodb as well as sso session cookie
class Client {
  constructor(name, id, secret, callback_urls) {
    this.client_name = name;
    this.client_id = id;
    this.client_secret = secret;
    this.callback_urls = callback_urls;
    this.updated_at = this.created_at =  Math.floor(Date.now() / 1000);
  }
}

module.exports = Client;
