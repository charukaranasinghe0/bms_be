import { Module } from '@nestjs/common';
import { CustomerProfileController } from './customer-profile.controller';
import { CustomerProfileService } from './customer-profile.service';
import { TierEngineController } from './tier-engine.controller';
import { LoyaltyService } from './loyalty.service';
import { TierEngineService } from './tier-engine.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CustomerProfileController, TierEngineController],
  providers: [CustomerProfileService, LoyaltyService, TierEngineService],
  exports: [CustomerProfileService, LoyaltyService, TierEngineService],
})
export class CustomerProfileModule {}
