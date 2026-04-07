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
import { IsInt } from 'class-validator';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

class AdjustStockDto {
  @IsInt()
  delta!: number;
}

function ok<T>(data: T, message?: string) {
  return { success: true, data, ...(message ? { message } : {}) };
}

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ── Categories ─────────────────────────────────────────────────────────────

  @Get('categories')
  @Roles('CASHIER', 'ADMIN')
  async listCategories() {
    return ok(await this.productsService.listCategories());
  }

  @Post('categories')
  @Roles('ADMIN')
  async createCategory(@Body() body: CreateCategoryDto) {
    return ok(await this.productsService.createCategory(body), 'Category created');
  }

  @Patch('categories/:id')
  @Roles('ADMIN')
  async updateCategory(@Param('id') id: string, @Body() body: UpdateCategoryDto) {
    return ok(await this.productsService.updateCategory(id, body), 'Category updated');
  }

  @Delete('categories/:id')
  @Roles('ADMIN')
  @HttpCode(204)
  async removeCategory(@Param('id') id: string) {
    await this.productsService.removeCategory(id);
  }

  // ── Products ───────────────────────────────────────────────────────────────

  // GET /api/products/low-stock — must be before :id route
  @Get('low-stock')
  @Roles('CASHIER', 'ADMIN')
  async getLowStock() {
    return ok(await this.productsService.getLowStock());
  }

  // GET /api/products?available=true&categoryId=xxx
  @Get()
  @Roles('CASHIER', 'ADMIN')
  async list(@Query('available') available?: string, @Query('categoryId') categoryId?: string) {
    const products =
      available === 'true'
        ? await this.productsService.listAvailable(categoryId)
        : await this.productsService.list(categoryId);
    return ok(products);
  }

  // GET /api/products/:id
  @Get(':id')
  @Roles('CASHIER', 'ADMIN')
  async getById(@Param('id') id: string) {
    return ok(await this.productsService.getById(id));
  }

  // POST /api/products
  @Post()
  @Roles('ADMIN')
  async create(@Body() body: CreateProductDto) {
    return ok(await this.productsService.create(body), 'Product created');
  }

  // PATCH /api/products/:id
  @Patch(':id')
  @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() body: UpdateProductDto) {
    return ok(await this.productsService.update(id, body), 'Product updated');
  }

  // PATCH /api/products/:id/toggle
  @Patch(':id/toggle')
  @Roles('ADMIN')
  async toggle(@Param('id') id: string) {
    return ok(await this.productsService.toggleAvailability(id), 'Availability toggled');
  }

  // PATCH /api/products/:id/stock
  @Patch(':id/stock')
  @Roles('ADMIN')
  async adjustStock(@Param('id') id: string, @Body() body: AdjustStockDto) {
    return ok(await this.productsService.adjustStock(id, body.delta), 'Stock updated');
  }

  // DELETE /api/products/:id
  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.productsService.remove(id);
  }
}
