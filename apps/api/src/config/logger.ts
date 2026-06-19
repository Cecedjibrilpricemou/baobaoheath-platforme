import winston from 'winston';
import { getContextUserId, getRequestId } from '../utils/request-context';

const isProduction = process.env.NODE_ENV === 'production';

const attachContext = winston.format((info) => {
  const requestId = getRequestId();
  const userId = getContextUserId();
  if (requestId) info.requestId = requestId;
  if (userId) info.userId = userId;
  return info;
})();

const devConsoleFormat = winston.format.printf(({ level, message, timestamp, requestId, userId, stack, ...meta }) => {
  const tags = [requestId ? `req:${String(requestId).slice(0, 8)}` : null, userId ? `user:${String(userId).slice(0, 8)}` : null]
    .filter(Boolean)
    .join(' ');
  const metaKeys = Object.keys(meta).filter((k) => meta[k] !== undefined);
  const metaStr = metaKeys.length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level}${tags ? ` [${tags}]` : ''}: ${stack ?? message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
  format: winston.format.combine(
    attachContext,
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    isProduction ? winston.format.json() : winston.format.combine(winston.format.colorize(), devConsoleFormat)
  ),
  transports: [new winston.transports.Console()],
});
