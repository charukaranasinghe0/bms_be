import { Controller, Get, Post, Body, Param, NotFoundException } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto.js';

@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  async findAll() {
    return this.customerService.findAll();
  }

  @Get('phone/:phone')
  async findByPhone(@Param('phone') phone: string) {
    const customer = await this.customerService.findByPhone(phone);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  @Post()
  async createCustomer(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customerService.createCustomer(createCustomerDto);
  }
}
