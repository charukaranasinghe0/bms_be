import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken } = await this.authService.register(dto);

    this.setRefreshCookie(res, refreshToken);

    return { accessToken };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken } = await this.authService.login(dto);

    this.setRefreshCookie(res, refreshToken);

    return { accessToken };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: Request) {
    return req.user;
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken =
      (req.cookies && (req.cookies.refresh_token as string | undefined)) ??
      (req.headers['x-refresh-token'] as string | undefined);

    const { accessToken, refreshToken: newRefreshToken } = await this.authService.refreshTokens(
      refreshToken ?? '',
    );

    this.setRefreshCookie(res, newRefreshToken);

    return { accessToken };
  }

  private setRefreshCookie(res: Response, token: string) {
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      path: '/api/auth/refresh',
    });
  }
}

