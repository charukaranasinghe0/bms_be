import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto.js';

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findByPhone(phone: string) {
    return this.prisma.customer.findUnique({ where: { phone } });
  }

  async findById(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async createCustomer(dto: CreateCustomerDto) {
    const existing = await this.prisma.customer.findUnique({ where: { phone: dto.phone } });
    if (existing) throw new ConflictException('Phone number already registered');
    return this.prisma.customer.create({ data: dto });
  }

  async updateCustomer(id: string, dto: Partial<CreateCustomerDto>) {
    await this.findById(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async deleteCustomer(id: string) {
    await this.findById(id);
    await this.prisma.customer.delete({ where: { id } });
  }
}
