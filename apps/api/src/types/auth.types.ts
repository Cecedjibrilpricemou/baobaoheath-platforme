import { Role } from '../config/generated/client/client';
export type { LoginDto, RegisterDto, VerifyLoginOtpDto, OtpLoginChallenge, OtpRequestDto, OtpVerifyDto, ForgotPasswordDto, ResetPasswordDto } from '@baobaoheath/shared-types';

export interface JwtPayload {
  userId: string;
  role: Role;
  sessionId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type LoginResult = TokenPair | import('@baobaoheath/shared-types').OtpLoginChallenge;
