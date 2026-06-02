import Redis from 'ioredis';
import { env } from './env.js';
import logger from '../utils/logger.js';

const redis = new Redis({ host: env.REDIS_HOST, port: env.REDIS_PORT, lazyConnect: true });

redis.on('error', (err) => logger.error({ err: err.message }, 'redis:error'));

export default redis;
