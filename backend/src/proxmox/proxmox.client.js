const axios = require('axios');
const https = require('https');
const config = require('../config/proxmox.config');

const agent = new https.Agent({ rejectUnauthorized: false });

async function proxmoxRequest(method, path, data) {
  try {
    const headers = {
      'Authorization': 'PVEAPIToken=' + config.token_id + '=' + config.token_secret
    };

    const response = await axios({
      method: method,
      url: config.proxmox_url + path,
      headers: headers,
      httpsAgent: agent,
      data: data || undefined
    });

    return response.data.data;
  } catch (error) {
    console.log('Erreur Proxmox [' + method.toUpperCase() + ' ' + path + ']: ' + error.message);
    return null;
  }
}

async function getNodeResources(nodeName) {
  const raw = await proxmoxRequest('get', '/nodes/' + nodeName + '/status');
  if (!raw) return null;

  const storageList = await proxmoxRequest('get', '/nodes/' + nodeName + '/storage');
  if (!storageList) return null;

  const localStorage = storageList.find(item => item.storage === 'local-lvm');

  return {
    ram: Math.floor(raw.memory.free / 1073741824),
    cpu: raw.cpuinfo.cpus,
    storage: localStorage ? Math.floor(localStorage.avail / 1073741824) : 0
  };
}

async function cloneContainer(node, templateId, newVmId) {
  return await proxmoxRequest('post', '/nodes/' + node + '/lxc/' + templateId + '/clone', {
    newid: newVmId
  });
}

async function configureContainer(node, vmId, configData) {
  return await proxmoxRequest('put', '/nodes/' + node + '/lxc/' + vmId + '/config', configData);
}

async function startContainer(node, vmId) {
  return await proxmoxRequest('post', '/nodes/' + node + '/lxc/' + vmId + '/status/start');
}

async function getContainerStatus(node, vmId) {
  return await proxmoxRequest('get', '/nodes/' + node + '/lxc/' + vmId + '/status/current');
}

module.exports = {
  getNodeResources,
  proxmoxRequest,
  cloneContainer,
  configureContainer,
  startContainer,
  getContainerStatus
};