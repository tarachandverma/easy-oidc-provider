const NodeCache = require( "node-cache" );
class PrivateNodeCache {
    constructor() {
        this.cache = new NodeCache();
    }
}
class SingletonIdpConnectionsCache {
    constructor() {
        throw new Error('Use SingletonIdpConnectionsCache.getInstance()');
    }
    static getInstance() {
        if (!SingletonIdpConnectionsCache.instance) {
            SingletonIdpConnectionsCache.instance = new PrivateNodeCache();
        }
        return SingletonIdpConnectionsCache.instance;
    }
}
module.exports = SingletonIdpConnectionsCache;