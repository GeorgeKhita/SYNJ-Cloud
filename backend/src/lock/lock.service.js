const redis_client = require('../config/redis.client');
const TTL = (process.env.LOCK_TTL_MIN || 15) * 60;

async function acquireLock(orderId, nodeId, requested) {
  const value = JSON.stringify({
    nodeId: nodeId,
    ram: requested.ram,
    cpu: requested.cpu,
    storage: requested.storage
  });
  const result = await redis_client.set('lock:' + orderId, value, 'EX', TTL, 'NX');
  return result;
}

async function releaseLock(orderId) {
  await redis_client.del('lock:' + orderId);
}

async function getLockedResources(nodeId) {
  const keys = await redis_client.keys('lock:*');
  let totalRam = 0;
  let totalCpu = 0;
  let totalStorage = 0;

  for (const key of keys) {
    const value = await redis_client.get(key);
    const lock = JSON.parse(value);
    if (lock.nodeId === nodeId) {
      totalRam += lock.ram;
      totalCpu += lock.cpu;
      totalStorage += lock.storage;
    }
  }

  return { ram: totalRam, cpu: totalCpu, storage: totalStorage };
}

module.exports = { acquireLock, releaseLock, getLockedResources };