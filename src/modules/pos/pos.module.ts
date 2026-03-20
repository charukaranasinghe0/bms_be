import { Module } from '@nestjs/common';
import { PosController } from './pos.controller';
import { PosService } from './services/pos.service';
import { PosCustomerRepository } from './repositories/customer.repository';
import { ProductRepository } from './repositories/product.repository';
import { OrderRepository } from './repositories/order.repository';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PosController],
  providers: [
    PosService,
    PosCustomerRepository,
    ProductRepository,
    OrderRepository,
  ],
})
export class PosModule {}
