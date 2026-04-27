const axios = require('axios');
const config = require('../config/proxmox.config');

async function getNodeResources(nodeName) {
    try {
        const response = await axios.get(config.proxmox_url + '/nodes/' + nodeName + '/status', {
            headers: {
            'Authorization': 'PVEAPIToken=' + config.token_id + '=' + config.token_secret
            }
        });

        return response.data;
    } catch(error) {
        console.log('Erreur de connexion Proxmox' + error.message);
        return null;
    }
}

module.exports = {getNodeResources};