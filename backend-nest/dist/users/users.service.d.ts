import { PrismaService } from '../prisma/prisma.service';
export interface SafeUser {
    id: string;
    username: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private toSafeUser;
    getCurrentUser(userId: string): Promise<SafeUser | null>;
    getAllUsers(): Promise<SafeUser[]>;
}
