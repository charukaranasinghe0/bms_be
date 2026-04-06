import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { TierEngineService } from './tier-engine.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { IsInt, IsOptional, IsString } from 'class-validator';

class AdjustPointsDto {
  @IsInt()    points!: number;
  @IsString() @IsOptional() reason?: string;
}

function ok<T>(data: T, message?: string) {
  return { success: true, data, ...(message ? { message } : {}) };
}

@Controller('customer-profile')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerProfileController {
  constructor(
    private readonly loyaltyService: LoyaltyService,
    private readonly tierEngine: TierEngineService,
  ) {}

  // GET /api/customer-profile/config  — legacy shape for existing FE consumers
  @Get('config')
  @Roles('CASHIER', 'ADMIN')
  async getConfig() {
    const [settings, tiers] = await Promise.all([
      this.tierEngine.getSettingsOrThrow(),
      this.tierEngine.listTiers(),
    ]);
    const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
    return ok({
      id:               settings.id,
      currencyCode:     settings.currencyCode,
      currencySymbol:   settings.currencySymbol,
      pointsPerAmount:  Number(settings.pointsPerCurrencyUnit),
      amountPerPoints:  1,
      redeemThreshold:  settings.redemptionThreshold,
      redeemDiscount:   Number(settings.redemptionValue),
      regularThreshold: sorted[1]?.minPoints ?? 200,
      loyalThreshold:   sorted[2]?.minPoints ?? 500,
      vipThreshold:     sorted[3]?.minPoints ?? 1000,
      updatedAt:        settings.updatedAt.toISOString(),
      updatedBy:        null,
    });
  }

  // GET /api/customer-profile/phone/:phone
  @Get('phone/:phone')
  @Roles('CASHIER', 'ADMIN')
  async getProfileByPhone(@Param('phone') phone: string) {
    return ok(await this.loyaltyService.getProfileByPhone(phone));
  }

  // GET /api/customer-profile/:id
  @Get(':id')
  @Roles('CASHIER', 'ADMIN')
  async getProfile(@Param('id') id: string) {
    return ok(await this.loyaltyService.getProfile(id));
  }

  // GET /api/customer-profile/:id/transactions
  @Get(':id/transactions')
  @Roles('CASHIER', 'ADMIN')
  async getTransactions(
    @Param('id') id: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return ok(
      await this.loyaltyService.getTransactions(
        id,
        skip ? parseInt(skip) : 0,
        take ? parseInt(take) : 20,
      ),
    );
  }

  // POST /api/customer-profile/:id/redeem
  @Post(':id/redeem')
  @Roles('CASHIER', 'ADMIN')
  async redeemPoints(@Param('id') id: string, @Body('orderId') orderId?: string) {
    const result = await this.loyaltyService.redeemPoints(id, orderId);
    return ok(
      { deducted: result.deducted, discount: result.discount },
      `Redeemed ${result.deducted} pts for ${result.discount} discount`,
    );
  }

  // PATCH /api/customer-profile/:id/points
  @Patch(':id/points')
  @Roles('ADMIN')
  async adjustPoints(@Param('id') id: string, @Body() dto: AdjustPointsDto) {
    return ok(await this.loyaltyService.adjustPoints(id, dto.points, dto.reason));
  }
}
