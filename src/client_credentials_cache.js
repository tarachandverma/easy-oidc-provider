const NodeCache = require( "node-cache" );
class PrivateNodeCache {
    constructor() {
        this.cache = new NodeCache();
    }
}
class SingletonClientCredentialsCache {
    constructor() {
        throw new Error('Use SingletonClientCredentialsCache.getInstance()');
    }
    static getInstance() {
        if (!SingletonClientCredentialsCache.instance) {
            SingletonClientCredentialsCache.instance = new PrivateNodeCache();
        }
        return SingletonClientCredentialsCache.instance;
    }
}
module.exports = SingletonClientCredentialsCache;