import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomerModule } from './modules/customer/customer.module';
import { PosModule } from './modules/pos/pos.module';
import { ProductsModule } from './modules/products/products.module';
import { ChefsModule } from './modules/chefs/chefs.module';
import { ReportsModule } from './modules/reports/reports.module';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { CustomerProfileModule } from './modules/customer-profile/customer-profile.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CustomerModule,
    PosModule,
    ProductsModule,
    ChefsModule,
    ReportsModule,
    KitchenModule,
    CustomerProfileModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

