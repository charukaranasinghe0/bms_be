import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllAvailable() {
    return this.prisma.product.findMany();
  }

  async findById(id: string) {
    return this.prisma.product.findUnique({ where: { id } });
  }

  async findManyByIds(ids: string[]) {
    return this.prisma.product.findMany({ where: { id: { in: ids } } });
  }

  async create(data: {
    name: string;
    price: number;
    imageUrl?: string;
    isAvailable?: boolean;
  }) {
    return this.prisma.product.create({ data });
  }
}
