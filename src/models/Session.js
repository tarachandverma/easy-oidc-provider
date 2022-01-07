// represents session object read/write in dynamodb as well as sso session cookie
class Session {
  constructor(id, user_id) {
    this.id = id;
    this.user_id = user_id;
    this.updated_at = this.created_at =  Math.floor(Date.now() / 1000);
  }
}

module.exports = Session;
