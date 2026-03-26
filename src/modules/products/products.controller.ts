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
import { ProductsService, CreateProductInput, UpdateProductInput } from './products.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

function ok<T>(data: T, message?: string) {
  return { success: true, data, ...(message ? { message } : {}) };
}

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // GET /api/products?available=true  — CASHIER + ADMIN
  @Get()
  @Roles('CASHIER', 'ADMIN')
  async list(@Query('available') available?: string) {
    const products =
      available === 'true'
        ? await this.productsService.listAvailable()
        : await this.productsService.list();
    return ok(products);
  }

  // GET /api/products/:id  — CASHIER + ADMIN
  @Get(':id')
  @Roles('CASHIER', 'ADMIN')
  async getById(@Param('id') id: string) {
    return ok(await this.productsService.getById(id));
  }

  // POST /api/products  — ADMIN only
  @Post()
  @Roles('ADMIN')
  async create(@Body() body: CreateProductInput) {
    return ok(await this.productsService.create(body), 'Product created');
  }

  // PATCH /api/products/:id  — ADMIN only
  @Patch(':id')
  @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() body: UpdateProductInput) {
    return ok(await this.productsService.update(id, body), 'Product updated');
  }

  // PATCH /api/products/:id/toggle  — ADMIN only (flip isAvailable)
  @Patch(':id/toggle')
  @Roles('ADMIN')
  async toggle(@Param('id') id: string) {
    return ok(await this.productsService.toggleAvailability(id), 'Availability toggled');
  }

  // DELETE /api/products/:id  — ADMIN only
  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.productsService.remove(id);
  }
}
