import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto.js';

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.customer.findMany();
  }

  async findByPhone(phone: string) {
    return this.prisma.customer.findUnique({
      where: { phone },
    });
  }

  async createCustomer(createCustomerDto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: createCustomerDto,
    });
  }
}
