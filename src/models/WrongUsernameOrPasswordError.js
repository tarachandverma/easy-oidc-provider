class WrongUsernameOrPasswordError {
  constructor(id, description) {
    this.id = id;
    this.description = description;
  }
}

module.exports = WrongUsernameOrPasswordError;
