const redis = require('ioredis');
const config = require('./redis.config');

const redis_client = new redis ({
    host : config.redis_host,
    port : config.redis_port
})

redis_client.on('connect', () => {
  console.log('Redis connecté');
});

redis_client.on('error', (err) => {
  console.log('Erreur Redis:', err.message);
});

module.exports = redis_client;