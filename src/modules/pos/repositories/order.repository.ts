import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface CreateOrderInput {
  customerId: string;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  status: string;
  txRef?: string;
  items: {
    productId: string;
    quantity: number;
    price: number;
    assignedChefId?: string;
  }[];
}

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params?: { skip?: number; take?: number; customerId?: string; from?: string; to?: string }) {
    const where: Record<string, unknown> = {};
    if (params?.customerId) where.customerId = params.customerId;
    if (params?.from || params?.to) {
      where.createdAt = {
        ...(params.from ? { gte: new Date(params.from) } : {}),
        ...(params.to ? { lte: new Date(params.to) } : {}),
      };
    }
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params?.skip ?? 0,
        take: params?.take ?? 50,
        include: {
          items: { include: { product: { select: { name: true } } } },
          customer: { select: { id: true, name: true, phone: true, email: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { orders, total };
  }

  async findById(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { name: true } } } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
    });
  }

  async create(input: CreateOrderInput) {
    return this.prisma.order.create({
      data: {
        customerId: input.customerId,
        subtotal: input.subtotal,
        discount: input.discount,
        total: input.total,
        paymentMethod: input.paymentMethod,
        status: input.status,
        txRef: input.txRef,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            assignedChefId: item.assignedChefId ?? null,
          })),
        },
      },
      include: {
        items: { include: { product: { select: { name: true } } } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
    });
  }
}
