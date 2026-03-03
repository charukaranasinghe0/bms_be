import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    private hashPassword;
    private comparePassword;
    register(dto: RegisterDto): Promise<{
        accessToken: string;
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
    }>;
}
