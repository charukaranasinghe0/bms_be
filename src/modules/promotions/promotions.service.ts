import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreatePromotionDto, UpdatePromotionDto } from './dto/promotion.dto';

export interface OrderItemInput {
  productId: string;
  quantity: number;
  price: number;
  /** cookCategory of the product — needed for CATEGORY scope matching */
  cookCategory?: string | null;
}

export interface AppliedPromotion {
  promotionId: string;
  name: string;
  discountAmount: number;
}

export interface PromotionApplicationResult {
  appliedPromotions: AppliedPromotion[];
  /** Total discount amount to subtract from the order subtotal */
  totalPromotionDiscount: number;
}

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(dto: CreatePromotionDto, createdBy?: string) {
    const conflict = await this.prisma.promotion.findFirst({
      where: { name: dto.name },
    });
    if (conflict) throw new ConflictException(`Promotion "${dto.name}" already exists`);

    if (dto.discountType === 'PERCENTAGE' && dto.discountValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }

    return this.prisma.promotion.create({
      data: {
        name: dto.name,
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        scope: dto.scope ?? 'ORDER',
        productIds: dto.productIds ?? [],
        category: dto.category,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        isActive: dto.isActive ?? true,
        minOrderAmount: dto.minOrderAmount,
        createdBy,
      },
    });
  }

  async findAll(activeOnly = false) {
    const now = new Date();
    return this.prisma.promotion.findMany({
      where: activeOnly
        ? { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } }
        : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promotion not found');
    return promo;
  }

  async update(id: string, dto: UpdatePromotionDto) {
    await this.findOne(id);

    if (dto.name) {
      const conflict = await this.prisma.promotion.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (conflict) throw new ConflictException(`Promotion "${dto.name}" already exists`);
    }

    if (dto.discountType === 'PERCENTAGE' && dto.discountValue !== undefined && dto.discountValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }

    return this.prisma.promotion.update({
      where: { id },
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.promotion.delete({ where: { id } });
  }

  async toggle(id: string) {
    const promo = await this.findOne(id);
    return this.prisma.promotion.update({
      where: { id },
      data: { isActive: !promo.isActive },
    });
  }

  // ── Promotion application (called by POS) ─────────────────────────────────

  /**
   * Evaluates all currently active promotions against the given order items
   * and returns the total discount amount plus a breakdown per promotion.
   *
   * Rules:
   *  - ORDER scope  → discount applies to the full subtotal
   *  - PRODUCT scope → discount applies only to matching product line totals
   *  - CATEGORY scope → discount applies only to items whose cookCategory matches
   *  - minOrderAmount guard is checked against the subtotal before applying
   *  - Multiple promotions can stack; each is calculated independently
   */
  async applyPromotions(
    items: OrderItemInput[],
    subtotal: number,
  ): Promise<PromotionApplicationResult> {
    const now = new Date();
    const activePromos = await this.prisma.promotion.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    });

    const appliedPromotions: AppliedPromotion[] = [];
    let totalPromotionDiscount = 0;

    for (const promo of activePromos) {
      // Check minimum order amount guard
      if (promo.minOrderAmount !== null && subtotal < promo.minOrderAmount) {
        continue;
      }

      let base = 0; // the amount the discount is applied against

      if (promo.scope === 'ORDER') {
        base = subtotal;
      } else if (promo.scope === 'PRODUCT') {
        // Sum line totals for matching products
        base = items
          .filter((i) => promo.productIds.includes(i.productId))
          .reduce((s, i) => s + i.price * i.quantity, 0);
      } else if (promo.scope === 'CATEGORY') {
        // Sum line totals for items in the matching cook category
        base = items
          .filter((i) => i.cookCategory && i.cookCategory === promo.category)
          .reduce((s, i) => s + i.price * i.quantity, 0);
      }

      if (base <= 0) continue;

      const discountAmount =
        promo.discountType === 'PERCENTAGE'
          ? parseFloat(((base * promo.discountValue) / 100).toFixed(2))
          : parseFloat(Math.min(promo.discountValue, base).toFixed(2));

      if (discountAmount <= 0) continue;

      appliedPromotions.push({
        promotionId: promo.id,
        name: promo.name,
        discountAmount,
      });
      totalPromotionDiscount += discountAmount;
    }

    return {
      appliedPromotions,
      totalPromotionDiscount: parseFloat(totalPromotionDiscount.toFixed(2)),
    };
  }
}
