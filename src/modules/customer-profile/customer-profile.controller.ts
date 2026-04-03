import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CustomerProfileService } from './customer-profile.service';
import { UpdateLoyaltyConfigDto, AdjustPointsDto } from './dto/loyalty.dto';

function ok<T>(data: T, message?: string) {
  return { success: true, data, ...(message ? { message } : {}) };
}

@Controller('customer-profile')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerProfileController {
  constructor(private readonly service: CustomerProfileService) {}

  // GET /api/customer-profile/config
  @Get('config')
  @Roles('ADMIN', 'CASHIER')
  async getConfig() {
    return ok(await this.service.getConfig());
  }

  // PATCH /api/customer-profile/config
  @Patch('config')
  @Roles('ADMIN')
  async updateConfig(
    @Body() dto: UpdateLoyaltyConfigDto,
    @CurrentUser() user: { username: string },
  ) {
    return ok(await this.service.updateConfig(dto, user.username), 'Loyalty config updated');
  }

  // GET /api/customer-profile/phone/:phone
  @Get('phone/:phone')
  @Roles('ADMIN', 'CASHIER')
  async getByPhone(@Param('phone') phone: string) {
    return ok(await this.service.getProfileByPhone(phone));
  }

  // GET /api/customer-profile/:id
  @Get(':id')
  @Roles('ADMIN', 'CASHIER')
  async getProfile(@Param('id') id: string) {
    return ok(await this.service.getProfile(id));
  }

  // PATCH /api/customer-profile/:id/points
  @Patch(':id/points')
  @Roles('ADMIN')
  async adjustPoints(@Param('id') id: string, @Body() dto: AdjustPointsDto) {
    return ok(await this.service.adjustPoints(id, dto.points), 'Points adjusted');
  }

  // POST /api/customer-profile/:id/redeem
  @Post(':id/redeem')
  @Roles('CASHIER', 'ADMIN')
  async redeemPoints(@Param('id') id: string) {
    return ok(await this.service.redeemPoints(id), 'Points redeemed');
  }
}
