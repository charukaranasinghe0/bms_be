import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CustomerProfileModule } from '../customer-profile/customer-profile.module';

@Module({
  imports: [PrismaModule, CustomerProfileModule],
  controllers: [CustomerController],
  providers: [CustomerService],
})
export class CustomerModule {}
