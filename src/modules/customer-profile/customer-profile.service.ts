/**
 * CustomerProfileService — legacy shim.
 * The loyalty logic has been migrated to LoyaltyService + TierEngineService.
 * This class is kept for backward-compatible injection in PosService but
 * all methods now delegate to the new services.
 */
import { Injectable } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { TierEngineService } from './tier-engine.service';
import type { UpdateLoyaltyConfigDto } from './dto/loyalty.dto';

@Injectable()
export class CustomerProfileService {
  constructor(
    private readonly loyaltyService: LoyaltyService,
    private readonly tierEngine: TierEngineService,
  ) {}

  /** @deprecated Use LoyaltyService.addPoints instead */
  async awardPointsForOrder(customerId: string, orderTotal: number) {
    // no-op — LoyaltyService.addPoints is called directly in PosService
  }

  /** @deprecated Use LoyaltyService.redeemPoints instead */
  async redeemPoints(customerId: string) {
    return this.loyaltyService.redeemPoints(customerId);
  }

  /** @deprecated Use TierEngineService directly */
  async getConfig() {
    const [settings, tiers] = await Promise.all([
      this.tierEngine.getSettingsOrThrow(),
      this.tierEngine.listTiers(),
    ]);
    const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
    return {
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
    };
  }

  /** @deprecated Use TierEngineService.updateSettings instead */
  async updateConfig(dto: UpdateLoyaltyConfigDto, _updatedBy: string) {
    return this.tierEngine.updateSettings({
      pointsPerCurrencyUnit: dto.pointsPerAmount,
      redemptionThreshold:   dto.redeemThreshold,
      redemptionValue:       dto.redeemDiscount,
      currencyCode:          dto.currencyCode,
      currencySymbol:        dto.currencySymbol,
    });
  }

  async getPosCustomerInfo(phone: string) {
    return this.loyaltyService.getPosCustomerInfo(phone);
  }
}
