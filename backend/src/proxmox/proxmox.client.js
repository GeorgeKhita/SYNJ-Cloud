const axios = require('axios');
const https = require('https');
const config = require('../config/proxmox.config');

const agent = new https.Agent({ rejectUnauthorized: false });

async function getNodeResources(nodeName) {
    try {
        const response = await axios.get(config.proxmox_url + '/nodes/' + nodeName + '/status', {
            headers: {
            'Authorization': 'PVEAPIToken=' + config.token_id + '=' + config.token_secret
            },
            httpsAgent: agent
        });

        const raw = response.data.data;
        return {
            ram: Math.floor(raw.memory.free / 1073741824),
            cpu: raw.cpuinfo.cpus,
            storage: Math.floor(raw.rootfs.free / 1073741824)
        };
    } catch(error) {
        console.log('Erreur de connexion Proxmox' + error.message);
        return null;
    }
}

module.exports = {getNodeResources};