// represents IdpConnection object read/write in dynamodb
class IdpConnection {
  constructor(id, name, protocol, oauth2_protocol_settings, oauth2_relying_party_settings) {
    this.id = id;
    this.name = name;
    this.protocol = protocol;
    this.oauth2_protocol_settings = oauth2_protocol_settings;          
    this.oauth2_relying_party_settings = oauth2_relying_party_settings;
    this.updated_at = this.created_at =  Math.floor(Date.now() / 1000);
  }
}

module.exports = IdpConnection;
