import { Controller, Post, Body, Req, UseGuards, Get, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
  AuthTokens,
} from './interfaces/jwt-payload.interface';

export class LoginDto {
  email!: string;
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto): Promise<AuthTokens> {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  async refreshTokens(@Req() req: AuthenticatedRequest): Promise<AuthTokens> {
    const userId = req.user.id;
    const refreshToken = req.user.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    return this.authService.refreshTokens(userId, refreshToken);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(@Req() req: AuthenticatedRequest): Promise<void> {
    return this.authService.logout(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getProfile(@Req() req: AuthenticatedRequest): AuthenticatedUser {
    return req.user;
  }
}
