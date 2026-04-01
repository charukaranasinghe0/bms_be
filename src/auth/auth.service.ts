import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  private async comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  private async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }

  private getAccessTokenTTL(): string {
    const ttlDays = Number(this.configService.get<string>('ACCESS_TOKEN_TTL_DAYS') ?? '2');
    return `${ttlDays}d`;
  }

  private getRefreshTokenTTL(): string {
    const ttlDays = Number(this.configService.get<string>('REFRESH_TOKEN_TTL_DAYS') ?? '7');
    return `${ttlDays}d`;
  }

  private getRefreshJwtSecret(): string {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('Missing JWT_REFRESH_SECRET in backend-nest/.env');
    }
    return secret;
  }

  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string; refreshExpiresAt: Date }> {
    const payload = { sub: user.id, username: user.username, role: user.role };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.getAccessTokenTTL(),
    });

    const refreshTtl = this.getRefreshTokenTTL();
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.getRefreshJwtSecret(),
      expiresIn: refreshTtl,
    });

    const ttlDays = Number(this.configService.get<string>('REFRESH_TOKEN_TTL_DAYS') ?? '7');
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + ttlDays);

    return { accessToken, refreshToken, refreshExpiresAt };
  }

  private async persistRefreshToken(userId: string, refreshToken: string, expiresAt: Date) {
    const tokenHash = await this.hashToken(refreshToken);

    // Invalidate previous active tokens for this user
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async register(dto: RegisterDto): Promise<{ accessToken: string; refreshToken: string; user: { id: string; username: string; role: string } }> {
    const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existing) throw new BadRequestException('Username already exists');

    const passwordHash = await this.hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: { username: dto.username, password: passwordHash },
    });

    const { accessToken, refreshToken, refreshExpiresAt } = await this.generateTokens(user);
    await this.persistRefreshToken(user.id, refreshToken, refreshExpiresAt);

    return { accessToken, refreshToken, user: { id: user.id, username: user.username, role: user.role } };
  }

  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return null;
    }

    const isValid = await this.comparePassword(password, user.password);
    if (!isValid) {
      return null;
    }

    return user;
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; refreshToken: string; user: { id: string; username: string; role: string } }> {
    const user = await this.validateUser(dto.username, dto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const { accessToken, refreshToken, refreshExpiresAt } = await this.generateTokens(user);
    await this.persistRefreshToken(user.id, refreshToken, refreshExpiresAt);

    return { accessToken, refreshToken, user: { id: user.id, username: user.username, role: user.role } };
  }

  async logout(payload: { userId: string }): Promise<void> {
    // Revoke all active refresh tokens for this user
    await this.prisma.refreshToken.updateMany({
      where: { userId: payload.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    let payload: { sub: string; username: string; role: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.getRefreshJwtSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const existing = await this.prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const isMatch = await bcrypt.compare(refreshToken, existing.tokenHash);
    if (!isMatch) {
      throw new UnauthorizedException('Refresh token mismatch');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Rotate: revoke current token and issue a new one
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const { accessToken, refreshToken: newRefreshToken, refreshExpiresAt } = await this.generateTokens(user);
    await this.persistRefreshToken(user.id, newRefreshToken, refreshExpiresAt);

    return { accessToken, refreshToken: newRefreshToken };
  }
}

