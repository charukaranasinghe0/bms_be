import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto, UpdatePromotionDto } from './dto/promotion.dto';

function ok<T>(data: T, message?: string) {
  return { success: true, data, ...(message ? { message } : {}) };
}

@Controller('promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PromotionsController {
  constructor(private readonly service: PromotionsService) {}

  // GET /api/promotions?active=true
  @Get()
  @Roles('ADMIN', 'CASHIER')
  async list(@Query('active') active?: string) {
    return ok(await this.service.findAll(active === 'true'));
  }

  // GET /api/promotions/:id
  @Get(':id')
  @Roles('ADMIN', 'CASHIER')
  async getOne(@Param('id') id: string) {
    return ok(await this.service.findOne(id));
  }

  // POST /api/promotions
  @Post()
  @Roles('ADMIN')
  async create(
    @Body() dto: CreatePromotionDto,
    @CurrentUser() user: { username: string },
  ) {
    return ok(await this.service.create(dto, user.username), 'Promotion created');
  }

  // PATCH /api/promotions/:id
  @Patch(':id')
  @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdatePromotionDto) {
    return ok(await this.service.update(id, dto), 'Promotion updated');
  }

  // PATCH /api/promotions/:id/toggle
  @Patch(':id/toggle')
  @Roles('ADMIN')
  async toggle(@Param('id') id: string) {
    return ok(await this.service.toggle(id), 'Promotion toggled');
  }

  // DELETE /api/promotions/:id
  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
  }
}
