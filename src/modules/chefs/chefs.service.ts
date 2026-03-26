import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateChefInput {
  name: string;
  status?: 'AVAILABLE' | 'BUSY';
}

export interface UpdateChefInput {
  name?: string;
  status?: 'AVAILABLE' | 'BUSY';
}

@Injectable()
export class ChefsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.chef.findMany({ orderBy: { name: 'asc' } });
  }

  async listAvailable() {
    return this.prisma.chef.findMany({
      where: { status: 'AVAILABLE' },
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: string) {
    const chef = await this.prisma.chef.findUnique({ where: { id } });
    if (!chef) throw new NotFoundException('Chef not found');
    return chef;
  }

  async create(input: CreateChefInput) {
    return this.prisma.chef.create({
      data: { name: input.name, status: input.status ?? 'AVAILABLE' },
    });
  }

  async update(id: string, input: UpdateChefInput) {
    await this.getById(id);
    return this.prisma.chef.update({ where: { id }, data: input });
  }

  async setStatus(id: string, status: 'AVAILABLE' | 'BUSY') {
    await this.getById(id);
    return this.prisma.chef.update({ where: { id }, data: { status } });
  }

  async remove(id: string) {
    await this.getById(id);
    await this.prisma.chef.delete({ where: { id } });
  }

  /**
   * Called during order creation.
   * Validates the chef exists and is AVAILABLE, then marks them BUSY.
   * Returns the chef record.
   */
  async assignToOrder(chefId: string, productName: string) {
    const chef = await this.getById(chefId);
    if (chef.status === 'BUSY') {
      throw new BadRequestException(
        `Chef "${chef.name}" is currently BUSY and cannot be assigned to "${productName}".`,
      );
    }
    return this.prisma.chef.update({
      where: { id: chefId },
      data: { status: 'BUSY' },
    });
  }

  /**
   * Batch-validates and assigns multiple chefs in one go.
   * Used by PosService during order creation.
   * Returns a map of chefId → chef record for reference.
   */
  async assignChefsForOrder(
    assignments: { chefId: string; productName: string }[],
  ): Promise<Map<string, { id: string; name: string; status: string }>> {
    if (assignments.length === 0) return new Map();

    // Deduplicate — a chef may appear on multiple items
    const uniqueChefIds = [...new Set(assignments.map((a) => a.chefId))];

    const chefs = await this.prisma.chef.findMany({
      where: { id: { in: uniqueChefIds } },
    });

    const chefMap = new Map(chefs.map((c) => [c.id, c]));

    // Validate all before mutating anything
    for (const { chefId, productName } of assignments) {
      const chef = chefMap.get(chefId);
      if (!chef) {
        throw new NotFoundException(`Chef ${chefId} not found`);
      }
      if (chef.status === 'BUSY') {
        throw new BadRequestException(
          `Chef "${chef.name}" is currently BUSY and cannot be assigned to "${productName}".`,
        );
      }
    }

    // Mark all assigned chefs as BUSY
    await this.prisma.chef.updateMany({
      where: { id: { in: uniqueChefIds } },
      data: { status: 'BUSY' },
    });

    return chefMap;
  }
}
