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
import { ChefsService } from './chefs.service';
import { CreateChefDto, UpdateChefDto, SetChefStatusDto } from './dto/chef.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

function ok<T>(data: T, message?: string) {
  return { success: true, data, ...(message ? { message } : {}) };
}

@Controller('chefs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChefsController {
  constructor(private readonly chefsService: ChefsService) {}

  // GET /api/chefs?available=true  — CASHIER + ADMIN
  @Get()
  @Roles('CASHIER', 'ADMIN')
  async list(@Query('available') available?: string) {
    const chefs =
      available === 'true'
        ? await this.chefsService.listAvailable()
        : await this.chefsService.list();
    return ok(chefs);
  }

  // GET /api/chefs/:id  — CASHIER + ADMIN
  @Get(':id')
  @Roles('CASHIER', 'ADMIN')
  async getById(@Param('id') id: string) {
    return ok(await this.chefsService.getById(id));
  }

  // POST /api/chefs  — ADMIN only
  @Post()
  @Roles('ADMIN')
  async create(@Body() body: CreateChefDto) {
    return ok(await this.chefsService.create(body), 'Chef created');
  }

  // PATCH /api/chefs/:id  — ADMIN only
  @Patch(':id')
  @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() body: UpdateChefDto) {
    return ok(await this.chefsService.update(id, body), 'Chef updated');
  }

  // PATCH /api/chefs/:id/status  — ADMIN only (manually set AVAILABLE | BUSY)
  @Patch(':id/status')
  @Roles('ADMIN')
  async setStatus(@Param('id') id: string, @Body() body: SetChefStatusDto) {
    return ok(await this.chefsService.setStatus(id, body.status), `Chef marked ${body.status}`);
  }

  // DELETE /api/chefs/:id  — ADMIN only
  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.chefsService.remove(id);
  }
}
