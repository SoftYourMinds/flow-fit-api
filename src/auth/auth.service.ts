import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(pass, user.passwordHash)) {
      const { passwordHash, hashedRefreshToken, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    const tokens = await this.getTokens(payload);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async register(data: any) {
    const existing = await this.usersService.findByEmail(data.email);
    if (existing) throw new BadRequestException('User already exists');

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.usersService.create({
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
    });
    return this.login(user);
  }

  async refreshTokens(userId: number, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.hashedRefreshToken) throw new UnauthorizedException('Access Denied');

    const rtMatches = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!rtMatches) throw new UnauthorizedException('Access Denied');

    const payload = { email: user.email, sub: user.id, role: user.role };
    const tokens = await this.getTokens(payload);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: number) {
    await this.usersService.updateRefreshToken(userId, null);
  }

  private async getTokens(payload: any) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: (process.env.JWT_ACCESS_EXPIRATION || '15m') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRATION || '7d') as any,
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private async updateRefreshToken(userId: number, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshToken(userId, hash);
  }
}
