import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
export declare class CustomerController {
    private readonly customerService;
    constructor(customerService: CustomerService);
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
    }>;
    createCustomer(createCustomerDto: CreateCustomerDto): Promise<{
        id: string;
        name: string;
        email: string | null;
        phone: string;
        createdAt: Date;
    }>;
}
