const proxmox = require('./proxmox.client');
const cache = require('./cache');


async function getResources(nodeName){
    const hit = cache.get(nodeName)
    if(hit){
        return hit;
    } else {
        const data = await proxmox.getNodeResources(nodeName);
        cache.set(nodeName, data);
        return data;
    }
}

module.exports = {getResources}