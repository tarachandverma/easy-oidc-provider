class ValidationError {
  constructor(id, description) {
    this.name = 'ValidationError'    
    this.code = id;
    this.description = this.message = description;
  }
}

module.exports = ValidationError;
