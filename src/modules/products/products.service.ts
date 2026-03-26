import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateProductInput {
  name: string;
  price: number;
  isAvailable?: boolean;
}

export interface UpdateProductInput {
  name?: string;
  price?: number;
  isAvailable?: boolean;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.product.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async listAvailable() {
    return this.prisma.product.findMany({
      where: { isAvailable: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getById(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(input: CreateProductInput) {
    const existing = await this.prisma.product.findFirst({
      where: { name: input.name },
    });
    if (existing) throw new ConflictException(`Product "${input.name}" already exists`);

    return this.prisma.product.create({
      data: {
        name: input.name,
        price: input.price,
        isAvailable: input.isAvailable ?? true,
      },
    });
  }

  async update(id: string, input: UpdateProductInput) {
    await this.getById(id); // throws 404 if not found

    if (input.name) {
      const conflict = await this.prisma.product.findFirst({
        where: { name: input.name, NOT: { id } },
      });
      if (conflict) throw new ConflictException(`Product "${input.name}" already exists`);
    }

    return this.prisma.product.update({ where: { id }, data: input });
  }

  async remove(id: string) {
    await this.getById(id); // throws 404 if not found
    await this.prisma.product.delete({ where: { id } });
  }

  async toggleAvailability(id: string) {
    const product = await this.getById(id);
    return this.prisma.product.update({
      where: { id },
      data: { isAvailable: !product.isAvailable },
    });
  }
}
