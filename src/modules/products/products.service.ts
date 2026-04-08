import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

const PRODUCT_INCLUDE = { category: { select: { id: true, name: true } } } as const;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Categories ─────────────────────────────────────────────────────────────

  async listCategories() {
    return this.prisma.productCategory.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createCategory(dto: CreateCategoryDto) {
    const existing = await this.prisma.productCategory.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Category "${dto.name}" already exists`);
    return this.prisma.productCategory.create({ data: dto });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const cat = await this.prisma.productCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    if (dto.name && dto.name !== cat.name) {
      const conflict = await this.prisma.productCategory.findUnique({ where: { name: dto.name } });
      if (conflict) throw new ConflictException(`Category "${dto.name}" already exists`);
    }
    return this.prisma.productCategory.update({ where: { id }, data: dto });
  }

  async removeCategory(id: string) {
    const cat = await this.prisma.productCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    // Unlink products before deleting
    await this.prisma.product.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
    await this.prisma.productCategory.delete({ where: { id } });
  }

  // ── Products ───────────────────────────────────────────────────────────────

  async list(categoryId?: string) {
    return this.prisma.product.findMany({
      where: categoryId ? { categoryId } : undefined,
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async listAvailable(categoryId?: string) {
    return this.prisma.product.findMany({
      where: { isAvailable: true, ...(categoryId ? { categoryId } : {}) },
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async getById(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(input: CreateProductDto) {
    // Check name uniqueness
    const existing = await this.prisma.product.findFirst({ where: { name: input.name } });
    if (existing) throw new ConflictException(`Product "${input.name}" already exists`);

    // Check SKU uniqueness if provided
    if (input.sku) {
      const skuExists = await this.prisma.product.findUnique({ where: { sku: input.sku } });
      if (skuExists) throw new ConflictException(`SKU "${input.sku}" already in use`);
    }

    return this.prisma.product.create({
      data: {
        name: input.name,
        description: input.description,
        sku: input.sku,
        price: input.price,
        unit: input.unit ?? 'piece',
        stockQty: input.stockQty ?? 0,
        lowStockThreshold: input.lowStockThreshold ?? 0,
        isAvailable: input.isAvailable ?? true,
        requiresCooking: input.requiresCooking ?? false,
        cookCategory: input.cookCategory ?? null,
        categoryId: input.categoryId ?? null,
      },
      include: PRODUCT_INCLUDE,
    });
  }

  async update(id: string, input: UpdateProductDto) {
    await this.getById(id);

    if (input.name) {
      const conflict = await this.prisma.product.findFirst({
        where: { name: input.name, NOT: { id } },
      });
      if (conflict) throw new ConflictException(`Product "${input.name}" already exists`);
    }

    if (input.sku) {
      const skuConflict = await this.prisma.product.findFirst({
        where: { sku: input.sku, NOT: { id } },
      });
      if (skuConflict) throw new ConflictException(`SKU "${input.sku}" already in use`);
    }

    return this.prisma.product.update({ where: { id }, data: input });
  }

  async remove(id: string) {
    await this.getById(id);
    await this.prisma.product.delete({ where: { id } });
  }

  async toggleAvailability(id: string) {
    const product = await this.getById(id);
    return this.prisma.product.update({
      where: { id },
      data: { isAvailable: !product.isAvailable },
    });
  }

  /**
   * Adjust stock quantity — positive to add, negative to deduct.
   * Used when orders are placed or cancelled.
   */
  async adjustStock(id: string, delta: number) {
    const product = await this.getById(id);
    const currentQty = product.stockQty ?? 0;
    const newQty = currentQty + delta;
    if (newQty < 0) throw new BadRequestException(`Insufficient stock for "${product.name}"`);

    return this.prisma.product.update({
      where: { id },
      data: {
        stockQty: newQty,
        ...(newQty === 0 && !product.requiresCooking ? { isAvailable: false } : {}),
        ...(newQty > 0 && !product.isAvailable ? { isAvailable: true } : {}),
      },
    });
  }

  /**
   * Get low stock products — for inventory alerts.
   */
  async getLowStock() {
    const products = await this.prisma.product.findMany({
      where: { lowStockThreshold: { gt: 0 } },
    });
    return products.filter((p) => p.stockQty <= p.lowStockThreshold);
  }
}
