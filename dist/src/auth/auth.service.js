"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
let AuthService = class AuthService {
    constructor(prisma, jwtService, configService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async hashPassword(plain) {
        return bcrypt.hash(plain, 10);
    }
    async comparePassword(plain, hash) {
        return bcrypt.compare(plain, hash);
    }
    async hashToken(token) {
        return bcrypt.hash(token, 10);
    }
    getAccessTokenTTL() {
        var _a;
        const ttlDays = Number((_a = this.configService.get('ACCESS_TOKEN_TTL_DAYS')) !== null && _a !== void 0 ? _a : '2');
        return `${ttlDays}d`;
    }
    getRefreshTokenTTL() {
        var _a;
        const ttlDays = Number((_a = this.configService.get('REFRESH_TOKEN_TTL_DAYS')) !== null && _a !== void 0 ? _a : '7');
        return `${ttlDays}d`;
    }
    getRefreshJwtSecret() {
        const secret = this.configService.get('JWT_REFRESH_SECRET');
        if (!secret) {
            throw new Error('Missing JWT_REFRESH_SECRET in backend-nest/.env');
        }
        return secret;
    }
    async generateTokens(user) {
        var _a;
        const payload = { sub: user.id, username: user.username, role: user.role };
        const accessToken = await this.jwtService.signAsync(payload, {
            expiresIn: this.getAccessTokenTTL(),
        });
        const refreshTtl = this.getRefreshTokenTTL();
        const refreshToken = await this.jwtService.signAsync(payload, {
            secret: this.getRefreshJwtSecret(),
            expiresIn: refreshTtl,
        });
        const ttlDays = Number((_a = this.configService.get('REFRESH_TOKEN_TTL_DAYS')) !== null && _a !== void 0 ? _a : '7');
        const refreshExpiresAt = new Date();
        refreshExpiresAt.setDate(refreshExpiresAt.getDate() + ttlDays);
        return { accessToken, refreshToken, refreshExpiresAt };
    }
    async persistRefreshToken(userId, refreshToken, expiresAt) {
        const tokenHash = await this.hashToken(refreshToken);
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
    async register(dto) {
        const existing = await this.prisma.user.findUnique({
            where: { username: dto.username },
        });
        if (existing) {
            throw new common_1.BadRequestException('Username already exists');
        }
        const passwordHash = await this.hashPassword(dto.password);
        const user = await this.prisma.user.create({
            data: {
                username: dto.username,
                password: passwordHash,
            },
        });
        const { accessToken, refreshToken, refreshExpiresAt } = await this.generateTokens(user);
        await this.persistRefreshToken(user.id, refreshToken, refreshExpiresAt);
        return { accessToken, refreshToken };
    }
    async validateUser(username, password) {
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
    async login(dto) {
        const user = await this.validateUser(dto.username, dto.password);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const { accessToken, refreshToken, refreshExpiresAt } = await this.generateTokens(user);
        await this.persistRefreshToken(user.id, refreshToken, refreshExpiresAt);
        return { accessToken, refreshToken };
    }
    async refreshTokens(refreshToken) {
        if (!refreshToken) {
            throw new common_1.UnauthorizedException('Missing refresh token');
        }
        let payload;
        try {
            payload = await this.jwtService.verifyAsync(refreshToken, {
                secret: this.getRefreshJwtSecret(),
            });
        }
        catch (_a) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
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
            throw new common_1.UnauthorizedException('Refresh token not found');
        }
        const isMatch = await bcrypt.compare(refreshToken, existing.tokenHash);
        if (!isMatch) {
            throw new common_1.UnauthorizedException('Refresh token mismatch');
        }
        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        await this.prisma.refreshToken.update({
            where: { id: existing.id },
            data: { revokedAt: new Date() },
        });
        const { accessToken, refreshToken: newRefreshToken, refreshExpiresAt } = await this.generateTokens(user);
        await this.persistRefreshToken(user.id, newRefreshToken, refreshExpiresAt);
        return { accessToken, refreshToken: newRefreshToken };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map