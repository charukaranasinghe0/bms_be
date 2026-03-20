import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PosCustomerRepository } from '../repositories/customer.repository';
import { ProductRepository } from '../repositories/product.repository';
import { OrderRepository } from '../repositories/order.repository';
import { CreateOrderDto } from '../dto/create-order.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customerRepo: PosCustomerRepository,
    private readonly productRepo: ProductRepository,
    private readonly orderRepo: OrderRepository,
  ) {}

  // ── Customer lookup (reuses existing CustomerService logic via repository) ──
  async lookupCustomerByPhone(phone: string) {
    const customer = await this.customerRepo.findByPhone(phone);
    if (!customer) {
      return { exists: false };
    }
    return {
      exists: true,
      data: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email ?? null,
        createdAt: customer.createdAt,
      },
    };
  }

  // ── Product catalog ────────────────────────────────────────────────────────
  async getProducts() {
    const products = await this.productRepo.findAllAvailable();
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      availability: p.isAvailable,
      ...(p.isAvailable ? {} : { canAssignToChef: true }),
    }));
  }

  // ── Chef list (read-only) ──────────────────────────────────────────────────
  async getChefs() {
    return this.prisma.chef.findMany({
      select: { id: true, name: true, status: true },
    });
  }

  // ── Order creation ─────────────────────────────────────────────────────────
  async createOrder(dto: CreateOrderDto) {
    // 1. Verify customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // 2. Fetch all products in one query
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.productRepo.findManyByIds(productIds);
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 3. Validate each item
    const resolvedItems: {
      productId: string;
      quantity: number;
      price: number;
      assignedChefId?: string;
    }[] = [];

    for (const item of dto.items) {
      const product = productMap.get(item.productId);

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      if (!product.isAvailable && !item.assignedChefId) {
        throw new UnprocessableEntityException(
          `Product "${product.name}" is unavailable. Assign a chef to include it in the order.`,
        );
      }

      resolvedItems.push({
        productId: product.id,
        quantity: item.quantity,
        price: product.price,
        assignedChefId: item.assignedChefId,
      });
    }

    // 4. Calculate totals
    const subtotal = resolvedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const discountPercent = dto.discount ?? 0;
    const discountAmount = parseFloat(((subtotal * discountPercent) / 100).toFixed(2));
    const total = parseFloat((subtotal - discountAmount).toFixed(2));

    // 5. Handle payment
    const txRef =
      dto.paymentMethod === 'CARD'
        ? `TXN-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`
        : undefined;

    // 6. Persist order
    const order = await this.orderRepo.create({
      customerId: dto.customerId,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: discountAmount,
      total,
      paymentMethod: dto.paymentMethod,
      status: 'PAID',
      txRef,
      items: resolvedItems,
    });

    return order;
  }
}
