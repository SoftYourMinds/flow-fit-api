import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload, AuthenticatedUser } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'secret',
      passReqToCallback: true,
    });
  }

  // ─── Public Methods ─────────────────────────────────────────────

  validate(req: Request, payload: JwtPayload): AuthenticatedUser {
    const authorization = req.get('Authorization');
    const refreshToken = authorization ? authorization.replace('Bearer', '').trim() : undefined;
    return { id: payload.sub, email: payload.email, role: payload.role, refreshToken };
  }
}
