const cache = new Map();

const TTL = (process.env.RESOURCE_CACHE_TTL || 60) * 1000;

function set(nodeName, data) {
  cache.set(nodeName, {
    data: data,
    timestamp: Date.now()
  });
}

function get(nodeName){
    const entry = cache.get(nodeName);
    if(entry){
        if(Date.now() - entry.timestamp > TTL){
            return null;     
        } else {
            return entry.data;
        }
    } else {
        return null;
    }
}

module.exports = {set, get};