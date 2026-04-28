const axios = require('axios');
const https = require('https');
const config = require('../config/proxmox.config');
const agent = new https.Agent({ rejectUnauthorized: false });

async function getNodeResources(nodeName) {
  try {
    const headers = {
      'Authorization': 'PVEAPIToken=' + config.token_id + '=' + config.token_secret
    };

    const statusResponse = await axios.get(
      config.proxmox_url + '/nodes/' + nodeName + '/status',
      { headers: headers, httpsAgent: agent }
    );
    const raw = statusResponse.data.data;

    const storageResponse = await axios.get(
      config.proxmox_url + '/nodes/' + nodeName + '/storage',
      { headers: headers, httpsAgent: agent }
    );
    const storageList = storageResponse.data.data;
    const localStorage = storageList.find(item => item.storage === 'local-lvm');

    return {
      ram: Math.floor(raw.memory.free / 1073741824),
      cpu: raw.cpuinfo.cpus,
      storage: localStorage ? Math.floor(localStorage.avail / 1073741824) : 0
    };
  } catch (error) {
    console.log('Erreur de connexion Proxmox: ' + error.message);
    return null;
  }
}

module.exports = { getNodeResources };