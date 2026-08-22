import { Request } from 'express';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: string;
  refreshToken?: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
