const resource = require('resource-router-middleware');
const uid = require('uid-safe');
var randtoken = require('rand-token');
const Client = require('../models/Client')

module.exports = ({ docClient, globalConfiguration }) => resource({

	/** Property name to store preloaded entity on `request`. */
	id : 'client',

	/** For requests with an `id`, you can auto-load the entity.
	 *  Errors terminate the request, success sets `req[id] = data`.
	 */    
    load(req, id, callback) {
        let client = null;

        const get_params = {
          TableName : globalConfiguration.dynamoDBTablesNames.clientCredential,
            Key:{
                "client_id": id
            }          
        }        
    	docClient.get(get_params, function(err, data) {
            if(data&&data.Item) {
        		//console.log(data);
                client = data.Item;
            }
            callback(null, client);                  
        });                   
    },    
    
	/** GET / - List all entities */
	index({ query }, res, next) {
        var query_params = {
            TableName : globalConfiguration.dynamoDBTablesNames.clientCredential
        };
        console.log(query);
        
        docClient.query(query_params, function(err, data) {
            res.set('X-Total-Count', data.Count);
            res.json(data.Items); 
        });
	},

	/** POST / - Create a new identity */
	create({ body }, res, next) {
        // validate name and callback_urls format
		if (body.name == null) return res.status(412).json(({status: 412, title: "create_client", detail: "name missing in request"}));
        
        var client_id = randtoken.generate(40);
        var client_secret = uid.sync(64);
        var client = new Client(body.name, client_id, client_secret, body.callback_urls);                            
        // store session in the database
        const create_params = {
          TableName : globalConfiguration.dynamoDBTablesNames.clientCredential,
          Item: client,
          ReturnValues: "NONE"
        }
        docClient.put(create_params, function(err, data) {
            var response = {
                client_id: client_id,
                client_secret: client_secret
            }
            return res.status(200).send(response);
        });
                                    
	},
    
	/** GET /:id - Return a given entity */
	read({ client }, res, next) {
        if(client&&client.created_at>0) {
            var response = {
                name: client.client_name,
                client_id: client.client_id,
                client_secret: client.client_secret,
                callback_urls: client.callback_urls
            }
            res.json(response);
        }else{
            res.sendStatus(404);
        }
	},

	/** PATCH /:id - Update a given entity */
	patch({ client, body }, res, next) {
        // update
        var update_params = {
            TableName : globalConfiguration.dynamoDBTablesNames.clientCredential,
            Key:{
                client_id: client.client_id
            },
            UpdateExpression: 
            "set \
            client_name = :cn, \
            client_secret = :cs, \
            callback_urls = :cbkurls, \
            updated_at = :upt"
            ,
            ConditionExpression: "created_at > :zero",
            ExpressionAttributeValues:{
                ":cn": body.name || client.client_name,
                ":cs": body.client_secret || client.client_secret,                
                ":cbkurls": body.callback_urls || client.client_name,
                ":upt": Math.floor(Date.now() / 1000),
                ":zero": 0
            },
            ReturnValues:"UPDATED_NEW"
        };
                        
        docClient.update(update_params, function(err, data) {
            // ignore dynamodb error, just return authenticated id
            if (err) {
                console.error("Unable to update item. Error JSON:", JSON.stringify(err));
            } else {
                console.log("UpdateItem succeeded:", JSON.stringify(data));
            }                           
            res.sendStatus(204)                       
        });
	},

	/** DELETE /:id - Delete a given entity */
	delete({ client }, res, next) {      
        if(client&&client.created_at>0) {
            const delete_params = {
                TableName : globalConfiguration.dynamoDBTablesNames.clientCredential,
                Key:{
                    "client_id": client.client_id
                }         
            }            
            docClient.delete(delete_params, function(err, data) {
                // ignore dynamodb error, just return the ldap returned identity
                res.sendStatus(204)                    
            });
        }else {
            res.sendStatus(404);
        }
	}
});
