import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TierEngineService } from '../customer-profile/tier-engine.service';
import { CreateCustomerDto } from './dto/create-customer.dto.js';

@Injectable()
export class CustomerService {
  constructor(
    private prisma: PrismaService,
    private tierEngine: TierEngineService,
  ) {}

  private async mapCustomer(c: {
    id: string; name: string; email: string | null; phone: string;
    currentPoints: number; lifetimePoints: number; tierName: string; createdAt: Date;
  }) {
    const settings = await this.tierEngine.getSettings();
    const threshold = settings.redemptionThreshold;
    const value     = Number(settings.redemptionValue);
    const redeemableBlocks = Math.floor(c.currentPoints / threshold);
    return {
      ...c,
      loyaltyPoints:   c.currentPoints,
      customerType:    c.tierName,
      loyaltyDiscount: redeemableBlocks * value,
    };
  }

  async findAll() {
    const customers = await this.prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
    return Promise.all(customers.map((c) => this.mapCustomer(c)));
  }

  async findByPhone(phone: string) {
    const c = await this.prisma.customer.findUnique({ where: { phone } });
    return c ? this.mapCustomer(c) : null;
  }

  async findById(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.mapCustomer(customer);
  }

  async createCustomer(dto: CreateCustomerDto) {
    const existing = await this.prisma.customer.findUnique({ where: { phone: dto.phone } });
    if (existing) throw new ConflictException('Phone number already registered');
    // Assign the lowest tier by default
    const tiers = await this.tierEngine.getActiveTiers();
    const lowestTier = tiers[0]?.name ?? '';
    const c = await this.prisma.customer.create({ data: { ...dto, tierName: lowestTier } });
    return this.mapCustomer(c);
  }

  async updateCustomer(id: string, dto: Partial<CreateCustomerDto>) {
    await this.findById(id);
    const c = await this.prisma.customer.update({ where: { id }, data: dto });
    return this.mapCustomer(c);
  }

  async deleteCustomer(id: string) {
    await this.findById(id);
    await this.prisma.customer.delete({ where: { id } });
  }
}
