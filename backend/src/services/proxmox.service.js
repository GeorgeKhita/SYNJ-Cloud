import https from 'https';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Client HTTP bas niveau
// ---------------------------------------------------------------------------

function proxmoxRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url     = new URL(`${env.PROXMOX_URL}${path}`);
    const payload = body ? JSON.stringify(body) : null;

    const req = https.request({
      hostname:           url.hostname,
      port:               url.port || 8006,
      path:               url.pathname + url.search,
      method:             method.toUpperCase(),
      headers: {
        Authorization:  `PVEAPIToken=${env.PROXMOX_TOKEN_ID}=${env.PROXMOX_SECRET}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
      rejectUnauthorized: false,
    }, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try   { resolve(JSON.parse(raw).data ?? null); }
        catch { reject(new Error(`Proxmox response invalide sur ${method} ${path}`)); }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Availability (pour les routes /availability/*)
// ---------------------------------------------------------------------------

export async function getNodeMemory() {
  const data = await proxmoxRequest('GET', `/nodes/${env.PROXMOX_DEFAULT_NODE}/status`);
  if (!data?.memory) throw new Error('Réponse Proxmox invalide (memory)');
  return {
    total_memory:     data.memory.total,
    used_memory:      data.memory.used,
    free_memory:      data.memory.free,
    available_memory: data.memory.free,
  };
}

export async function getNodeCpu() {
  const data = await proxmoxRequest('GET', `/nodes/${env.PROXMOX_DEFAULT_NODE}/status`);
  if (data?.cpu == null) throw new Error('Réponse Proxmox invalide (cpu)');
  return { available_cpu: data.cpu };
}

export async function getNodeStorage() {
  const list = await proxmoxRequest('GET', `/nodes/${env.PROXMOX_DEFAULT_NODE}/storage`);
  if (!Array.isArray(list)) throw new Error('Réponse Proxmox invalide (storage)');
  const active    = list.filter(s => s.active && s.enabled);
  const total     = active.reduce((s, st) => s + (st.total || 0), 0);
  const available = active.reduce((s, st) => s + (st.avail || 0), 0);
  return { total_storage: total, available_storage: available };
}

// ---------------------------------------------------------------------------
// Anti-survente (utilisé par reservation.service.js)
// ---------------------------------------------------------------------------

export async function getCapacity() {
  try {
    const [nodeStatus, storageList] = await Promise.all([
      proxmoxRequest('GET', `/nodes/${env.PROXMOX_DEFAULT_NODE}/status`),
      proxmoxRequest('GET', `/nodes/${env.PROXMOX_DEFAULT_NODE}/storage`),
    ]);

    const freeCpu       = nodeStatus.maxcpu - Math.ceil(nodeStatus.cpu * nodeStatus.maxcpu);
    const freeRamGb     = Math.floor(nodeStatus.memory.free / 1073741824);
    const freeStorageGb = Math.floor(
      storageList.filter(s => s.active && s.enabled).reduce((sum, s) => sum + (s.avail || 0), 0)
      / 1073741824
    );

    return { cpu: freeCpu, ram_gb: freeRamGb, storage_gb: freeStorageGb };
  } catch (err) {
    logger.warn({ err: err.message }, 'proxmox:capacity_unreachable');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Gestion des conteneurs LXC
// ---------------------------------------------------------------------------

export async function getNextVmId() {
  return Number(await proxmoxRequest('GET', '/cluster/nextid'));
}

export async function cloneContainer(node, templateId, newVmId) {
  return proxmoxRequest('POST', `/nodes/${node}/lxc/${templateId}/clone`, { newid: newVmId });
}

export async function configureContainer(node, vmId, config) {
  return proxmoxRequest('PUT', `/nodes/${node}/lxc/${vmId}/config`, config);
}

export async function startContainer(node, vmId) {
  return proxmoxRequest('POST', `/nodes/${node}/lxc/${vmId}/status/start`);
}

export async function stopContainer(node, vmId) {
  return proxmoxRequest('POST', `/nodes/${node}/lxc/${vmId}/status/stop`);
}

export async function deleteContainer(node, vmId) {
  return proxmoxRequest('DELETE', `/nodes/${node}/lxc/${vmId}`);
}

export async function getContainerStatus(node, vmId) {
  return proxmoxRequest('GET', `/nodes/${node}/lxc/${vmId}/status/current`);
}

export async function getContainerIp(node, vmId) {
  const config = await proxmoxRequest('GET', `/nodes/${node}/lxc/${vmId}/config`);
  if (!config?.net0) return null;
  const match = config.net0.match(/ip=(\d+\.\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}
