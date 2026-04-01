import { Controller, Get, Post, Put, Delete, Body, Param, NotFoundException, UseGuards, HttpCode } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @Roles('CASHIER', 'ADMIN')
  async findAll() {
    return this.customerService.findAll();
  }

  @Get(':id')
  @Roles('CASHIER', 'ADMIN')
  async findById(@Param('id') id: string) {
    return this.customerService.findById(id);
  }

  @Get('phone/:phone')
  @Roles('CASHIER', 'ADMIN')
  async findByPhone(@Param('phone') phone: string) {
    const customer = await this.customerService.findByPhone(phone);
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  @Post()
  @Roles('CASHIER', 'ADMIN')
  async createCustomer(@Body() dto: CreateCustomerDto) {
    return this.customerService.createCustomer(dto);
  }

  @Put(':id')
  @Roles('CASHIER', 'ADMIN')
  async updateCustomer(@Param('id') id: string, @Body() dto: Partial<CreateCustomerDto>) {
    return this.customerService.updateCustomer(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  async deleteCustomer(@Param('id') id: string) {
    await this.customerService.deleteCustomer(id);
  }
}
