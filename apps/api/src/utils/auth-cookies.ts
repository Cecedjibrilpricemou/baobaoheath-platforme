import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { Response } from 'express';
import { env } from '../config/env';
import { TokenPair } from '../types/auth.types';
import { ACCESS_COOKIE, CSRF_COOKIE } from '../middlewares/auth.middleware';

export const REFRESH_COOKIE = 'bb_refresh';

const BASE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1',
};

const REFRESH_COOKIE_OPTIONS = {
  ...BASE_COOKIE_OPTIONS,
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/** Access-cookie maxAge is derived from the token's own `exp` claim so it never drifts from JWT_EXPIRES_IN. */
function accessTokenMaxAgeMs(accessToken: string): number {
  const decoded = jwt.decode(accessToken) as { exp?: number } | null;
  if (!decoded?.exp) return 15 * 60 * 1000;
  return Math.max(decoded.exp * 1000 - Date.now(), 0);
}

/** Sets the httpOnly access/refresh cookies and the JS-readable CSRF double-submit cookie. */
export function setAuthCookies(res: Response, tokenPair: TokenPair): void {
  const csrfToken = randomBytes(32).toString('hex');
  const maxAge = accessTokenMaxAgeMs(tokenPair.accessToken);

  res.cookie(REFRESH_COOKIE, tokenPair.refreshToken, REFRESH_COOKIE_OPTIONS);
  res.cookie(ACCESS_COOKIE, tokenPair.accessToken, { ...BASE_COOKIE_OPTIONS, maxAge });
  res.cookie(CSRF_COOKIE, csrfToken, { ...BASE_COOKIE_OPTIONS, httpOnly: false, maxAge });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 });
  res.clearCookie(ACCESS_COOKIE, { ...BASE_COOKIE_OPTIONS, maxAge: 0 });
  res.clearCookie(CSRF_COOKIE, { ...BASE_COOKIE_OPTIONS, httpOnly: false, maxAge: 0 });
}
