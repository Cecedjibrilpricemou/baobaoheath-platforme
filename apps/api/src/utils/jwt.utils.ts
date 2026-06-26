import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { JwtPayload, TokenPair } from '../types/auth.types';

const rawJwtSecret = process.env.JWT_SECRET;
if (!rawJwtSecret) {
  throw new Error('JWT_SECRET manquant');
}
const JWT_SECRET: Secret = rawJwtSecret;

const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? '15m') as SignOptions['expiresIn'];
const JWT_REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'];

export function generateTokenPair(payload: JwtPayload): TokenPair {
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  const refreshToken = jwt.sign(
    { userId: payload.userId, sessionId: payload.sessionId },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload as JwtPayload;
}

export function verifyRefreshToken(token: string): Pick<JwtPayload, 'userId' | 'sessionId'> {
  return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload as Pick<JwtPayload, 'userId' | 'sessionId'>;
}
