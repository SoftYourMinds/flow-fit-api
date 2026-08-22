import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthTokens, JwtPayload } from './interfaces/jwt-payload.interface';

export type SanitizedUser = Omit<User, 'passwordHash' | 'hashedRefreshToken'>;

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // ─── Public Methods ─────────────────────────────────────────────

  async validateUser(email: string, pass: string): Promise<SanitizedUser | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(pass, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tgChatId: user.tgChatId,
      tgLinkToken: user.tgLinkToken,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async login(user: { id: number; email: string; role: string }): Promise<AuthTokens> {
    const payload: JwtPayload = { email: user.email, sub: user.id, role: user.role };
    const tokens = await this.getTokens(payload);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async register(data: RegisterInput): Promise<AuthTokens> {
    const existing = await this.usersService.findByEmail(data.email);
    if (existing) {
      throw new BadRequestException('User already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.usersService.create({
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
    });
    return this.login(user);
  }

  async refreshTokens(userId: number, refreshToken: string): Promise<AuthTokens> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException('Access Denied');
    }

    const rtMatches = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!rtMatches) {
      throw new UnauthorizedException('Access Denied');
    }

    const payload: JwtPayload = { email: user.email, sub: user.id, role: user.role };
    const tokens = await this.getTokens(payload);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: number): Promise<void> {
    return this.usersService.updateRefreshToken(userId, null);
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private async getTokens(payload: JwtPayload): Promise<AuthTokens> {
    const accessExpiration = process.env.JWT_ACCESS_EXPIRATION || '15m';
    const refreshExpiration = process.env.JWT_REFRESH_EXPIRATION || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: accessExpiration as `${number}m` | `${number}d` | `${number}h` | `${number}s`,
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: refreshExpiration as `${number}m` | `${number}d` | `${number}h` | `${number}s`,
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private async updateRefreshToken(userId: number, refreshToken: string): Promise<void> {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshToken(userId, hash);
  }
}
