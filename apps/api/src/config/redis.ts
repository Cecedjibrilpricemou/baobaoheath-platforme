import Redis from 'ioredis';
import { logger } from './logger';

let redisClient: Redis | undefined;

export function initRedis(url: string): Redis {
  redisClient = new Redis(url);
  redisClient.on('error', (err) => logger.warn('Redis indisponible', { error: err.message }));
  return redisClient;
}

export function getRedis(): Redis | undefined {
  return redisClient;
}
