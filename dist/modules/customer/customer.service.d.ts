import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
export declare class CustomerService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        id: string;
        name: string;
        email: string | null;
        phone: string;
        createdAt: Date;
    }[]>;
    findByPhone(phone: string): Promise<{
        id: string;
        name: string;
        email: string | null;
        phone: string;
        createdAt: Date;
    } | null>;
    createCustomer(createCustomerDto: CreateCustomerDto): Promise<{
        id: string;
        name: string;
        email: string | null;
        phone: string;
        createdAt: Date;
    }>;
}
