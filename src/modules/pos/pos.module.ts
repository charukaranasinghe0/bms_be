import { Module } from '@nestjs/common';
import { PosController } from './pos.controller';
import { PosService } from './services/pos.service';
import { BillService } from './services/bill.service';
import { NotificationService } from './services/notification.service';
import { PosCustomerRepository } from './repositories/customer.repository';
import { ProductRepository } from './repositories/product.repository';
import { OrderRepository } from './repositories/order.repository';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { ChefsModule } from '../chefs/chefs.module';
import { KitchenModule } from '../kitchen/kitchen.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CustomerProfileModule } from '../customer-profile/customer-profile.module';

@Module({
  imports: [PrismaModule, ProductsModule, ChefsModule, KitchenModule, InventoryModule, CustomerProfileModule],
  controllers: [PosController],
  providers: [
    PosService,
    BillService,
    NotificationService,
    PosCustomerRepository,
    ProductRepository,
    OrderRepository,
  ],
})
export class PosModule {}
