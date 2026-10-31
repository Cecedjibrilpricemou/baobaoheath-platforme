import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { JwtPayload, TokenPair } from '../types/auth.types';
import { UnauthorizedError } from './app-error';

const rawJwtSecret = process.env.JWT_SECRET;
if (!rawJwtSecret) {
  throw new Error('JWT_SECRET manquant');
}
const JWT_SECRET: Secret = rawJwtSecret;

// Un secret distinct pour le jeton de rafraichissement : signe avec le meme,
// il passait pour un jeton d'acces (tous les droits du compte pendant 7 jours).
const rawJwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
if (!rawJwtRefreshSecret) {
  throw new Error('JWT_REFRESH_SECRET manquant');
}
const JWT_REFRESH_SECRET: Secret = rawJwtRefreshSecret;

const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? '15m') as SignOptions['expiresIn'];
const JWT_REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'];

/**
 * Le type est verifie en plus du secret : un secret distinct sans controle
 * de type laisserait passer l'inverse si les deux secrets venaient un jour a
 * etre identiques par erreur de configuration.
 */
type TypeJeton = 'access' | 'refresh';

export function generateTokenPair(payload: JwtPayload): TokenPair {
  const accessToken = jwt.sign({ ...payload, typ: 'access' satisfies TypeJeton }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  const refreshToken = jwt.sign(
    { userId: payload.userId, sessionId: payload.sessionId, typ: 'refresh' satisfies TypeJeton },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
}

function verifier(token: string, secret: Secret, attendu: TypeJeton): jwt.JwtPayload {
  let decode: string | jwt.JwtPayload;
  try {
    decode = jwt.verify(token, secret);
  } catch {
    throw new UnauthorizedError('Jeton invalide ou expire');
  }
  if (typeof decode === 'string' || decode.typ !== attendu) {
    throw new UnauthorizedError('Jeton invalide ou expire');
  }
  return decode;
}

export function verifyAccessToken(token: string): JwtPayload {
  return verifier(token, JWT_SECRET, 'access') as JwtPayload;
}

export function verifyRefreshToken(token: string): Pick<JwtPayload, 'userId' | 'sessionId'> {
  return verifier(token, JWT_REFRESH_SECRET, 'refresh') as Pick<JwtPayload, 'userId' | 'sessionId'>;
}
