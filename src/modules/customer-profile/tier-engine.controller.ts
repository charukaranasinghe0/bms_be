import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TierEngineService, type TierDto } from './tier-engine.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  IsBoolean, IsInt, IsNumber, IsObject, IsOptional,
  IsString, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── DTOs ──────────────────────────────────────────────────────────────────────

class PerksConfigDto {
  @IsBoolean() @IsOptional() free_coffee?: boolean;
  @IsNumber()  @IsOptional() birthday_discount?: number;
  [key: string]: unknown;
}

class CreateTierDto implements TierDto {
  @IsString()  name!: string;
  @IsInt() @Min(0) minPoints!: number;
  @IsInt() @Min(0) @IsOptional() maxPoints!: number | null;
  @IsNumber() @Min(0) pointMultiplier!: number;
  @IsObject() @IsOptional() @ValidateNested() @Type(() => PerksConfigDto)
  perksConfig: Record<string, unknown> = {};
}

class UpdateTierDto {
  @IsString()  @IsOptional() name?: string;
  @IsInt() @Min(0) @IsOptional() minPoints?: number;
  @IsInt() @Min(0) @IsOptional() maxPoints?: number | null;
  @IsNumber() @Min(0) @IsOptional() pointMultiplier?: number;
  @IsObject() @IsOptional() perksConfig?: Record<string, unknown>;
}

class UpdateSettingsDto {
  @IsNumber() @Min(0) @IsOptional() pointsPerCurrencyUnit?: number;
  @IsInt()    @Min(1) @IsOptional() redemptionThreshold?: number;
  @IsNumber() @Min(0) @IsOptional() redemptionValue?: number;
  @IsString() @IsOptional() currencyCode?: string;
  @IsString() @IsOptional() currencySymbol?: string;
}

function ok<T>(data: T, message?: string) {
  return { success: true, data, ...(message ? { message } : {}) };
}

// ── Controller ────────────────────────────────────────────────────────────────
// IMPORTANT: literal-path routes (settings, recalculate) MUST be declared
// before parameterized routes (:id) so NestJS doesn't swallow them.

@Controller('loyalty-tiers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TierEngineController {
  constructor(private readonly tierEngine: TierEngineService) {}

  // GET /api/loyalty-tiers
  @Get()
  @Roles('CASHIER', 'ADMIN')
  async listTiers() {
    return ok(await this.tierEngine.listTiers());
  }

  // GET /api/loyalty-tiers/settings  ← must be before GET :id
  @Get('settings')
  @Roles('CASHIER', 'ADMIN')
  async getSettings() {
    return ok(await this.tierEngine.getSettingsOrThrow());
  }

  // PATCH /api/loyalty-tiers/settings  ← must be before PATCH :id
  @Patch('settings')
  @Roles('ADMIN')
  async updateSettings(@Body() dto: UpdateSettingsDto) {
    return ok(await this.tierEngine.updateSettings(dto), 'Settings updated');
  }

  // POST /api/loyalty-tiers/recalculate  ← must be before POST :id (if any)
  @Post('recalculate')
  @Roles('ADMIN')
  async recalculate() {
    return ok(await this.tierEngine.recalculateAllCustomerTiers(), 'All customer tiers recalculated');
  }

  // POST /api/loyalty-tiers
  @Post()
  @Roles('ADMIN')
  async createTier(@Body() dto: CreateTierDto) {
    return ok(await this.tierEngine.createTier(dto), 'Tier created');
  }

  // PATCH /api/loyalty-tiers/:id
  @Patch(':id')
  @Roles('ADMIN')
  async updateTier(@Param('id') id: string, @Body() dto: UpdateTierDto) {
    return ok(await this.tierEngine.updateTier(id, dto), 'Tier updated');
  }

  // DELETE /api/loyalty-tiers/:id
  @Delete(':id')
  @Roles('ADMIN')
  async deleteTier(@Param('id') id: string) {
    return ok(await this.tierEngine.deleteTier(id), 'Tier deleted');
  }
}
