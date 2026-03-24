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
