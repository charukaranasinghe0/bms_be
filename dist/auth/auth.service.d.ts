import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly configService;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService);
    private hashPassword;
    private comparePassword;
    private hashToken;
    private getAccessTokenTTL;
    private getRefreshTokenTTL;
    private getRefreshJwtSecret;
    private generateTokens;
    private persistRefreshToken;
    register(dto: RegisterDto): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    validateUser(username: string, password: string): Promise<{
        username: string;
        password: string;
        id: string;
        role: string;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    refreshTokens(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
}
