const resource = require('resource-router-middleware');
const IdpConnection = require('../models/IdpConnection')

module.exports = ({ docClient, globalConfiguration }) => resource({

	/** Property name to store preloaded entity on `request`. */
	id : 'connection',

	/** For requests with an `id`, you can auto-load the entity.
	 *  Errors terminate the request, success sets `req[id] = data`.
	 */    
    load(req, id, callback) {
        let connection = null;
        const get_params = {
          TableName : globalConfiguration.dynamoDBTablesNames.idpConnection,
            Key:{
                "id": id
            }          
        }        
    	docClient.get(get_params, function(err, data) {
            //console.log(err);
            //console.log(data);
            if(data&&data.Item) {
        		console.log(data);
                connection = data.Item;
            }
            callback(null, connection);
        });                   
    },    
    
	/** GET / - List all entities */
	index({ query }, res, next) {
        var query_params = {
            TableName : globalConfiguration.dynamoDBTablesNames.idpConnection
        };
        //console.log(query);
        if (query.type || query.type) {
            query_params.IndexName = 'type_index',
            query_params.KeyConditionExpression = "type = :typ",
            query_params.ExpressionAttributeValues = {
                ":typ": query.type
            }
        }        
        docClient.query(query_params, function(err, data) {
            if(err){
                res.status(err.statusCode||412).json(({status: err.statusCode, title: "get_identity_providers", detail: JSON.stringify(err)}));                                
            }else if(data) {
                res.set('X-Total-Count', data.Count);
                res.json(data.Items);
            } 
        });
	},

	/** POST / - Create a new connection_id */
	create({ body }, res, next) {
        // validate name and callback_urls format
		if (body.id == null) return res.status(412).json(({status: 412, title: "create_idp_connection", detail: "idp connection id missing"}));
        if (body.name == null) return res.status(412).json(({status: 412, title: "create_idp_connection", detail: "idp connection name missing"}));
        if (body.protocol == null) return res.status(412).json(({status: 412, title: "create_idp_connection", detail: "idp connection protocol missing"}));
        if (body.protocol !== 'oauth2') return res.status(412).json(({status: 412, title: "create_idp_connection", detail: "only oauth2 protocol is supported right now"}));
        if (body.oauth2_protocol_settings == null) return res.status(412).json(({status: 412, title: "create_idp_connection", detail: "oauth2_protocol_settings is missing"}));
        if (body.oauth2_relying_party_settings == null) return res.status(412).json(({status: 412, title: "create_idp_connection", detail: "oauth2_relying_party_settings is missing"}));                                        
        
        var idpConnection = new IdpConnection(body.id, body.name, body.protocol, body.oauth2_protocol_settings, body.oauth2_relying_party_settings);                         
        // store connection in the database
        const create_params = {
          TableName : globalConfiguration.dynamoDBTablesNames.idpConnection,
          Item: idpConnection,
          ReturnValues: "NONE"
        }
        docClient.put(create_params, function(err, data) {
            res.location('/api/idp_connections/' + idpConnection.id);
            res.status(201).json({});
        });
	},
    
	/** GET /:id - Return a given entity */
	read({ connection }, res, next) {
        if(connection&&connection.created_at>0) {
            var response = {
                name: connection.name,
                id: connection.id
            }
            res.json(response);
        }else{
            res.sendStatus(404);
        }
	},

	/** PATCH /:id - Update a given entity */
	patch({ connection, body }, res, next) {
        // update
        var update_params = {
            TableName : globalConfiguration.dynamoDBTablesNames.idpConnection,
            Key:{
                id: connection.id
            },
            UpdateExpression: 
            "set \
            #cn = :cn, \
            updated_at = :upt"
            ,
            ConditionExpression: "created_at > :zero",
            ExpressionAttributeNames: {
               '#cn': "name"
            },            
            ExpressionAttributeValues:{
                ":cn": body.name || connection.name,
                ":upt": Math.floor(Date.now() / 1000),
                ":zero": 0
            },
            ReturnValues:"UPDATED_NEW"
        };
                        
        docClient.update(update_params, function(err, data) {
            // ignore dynamodb error, just return id
            if (err) {
                console.error("Unable to update item. Error JSON:", JSON.stringify(err));
            } else {
                console.log("UpdateItem succeeded:", JSON.stringify(data));
            }                           
            res.sendStatus(204)                       
        });
	},

	/** DELETE /:id - Delete a given entity */
	delete({ connection }, res, next) {      
        if(connection&&connection.created_at>0) {
            const delete_params = {
                TableName : globalConfiguration.dynamoDBTablesNames.idpConnection,
                Key:{
                    "id": connection.id
                }         
            }            
            docClient.delete(delete_params, function(err, data) {
                // ignore dynamodb error, just return the connection
                res.sendStatus(204)                    
            });
        }else {
            res.sendStatus(404);
        }
	}
});
