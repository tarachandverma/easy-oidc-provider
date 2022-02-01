class WrongUsernameOrPasswordError {
  constructor(email, description) {
    this.name = 'WrongUsernameOrPasswordError'
    this.username = email;
    this.description = this.message = description;
  }
}

module.exports = WrongUsernameOrPasswordError;
