const redis_client = require('../config/redis.client'); 

const TTL = (process.env.LOCK_TTL_MIN || 15) * 60;

async function acquireLock(orderId, nodeId) {
  const result = await redis_client.set('lock:' + nodeId, orderId, 'EX', TTL, 'NX');
  return result;
}

async function releaseLock(nodeId) {
  await redis_client.del('lock:' + nodeId);
}

module.exports = {acquireLock, releaseLock};