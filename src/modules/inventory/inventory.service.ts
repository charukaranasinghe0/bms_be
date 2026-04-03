import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateInventoryItemDto,
  CreateBatchDto,
  AdjustStockDto,
  CreateEquipmentDto,
  CreateMaintenanceDto,
  CreateRecipeItemDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── Items ──────────────────────────────────────────────────────────────────

  async createItem(dto: CreateInventoryItemDto) {
    return this.prisma.inventoryItem.create({
      data: {
        name: dto.name,
        category: dto.category,
        unit: dto.unit,
        isPerishable: dto.isPerishable ?? false,
        minReorderLevel: dto.minReorderLevel ?? 0,
      },
    });
  }

  async listItems() {
    const items = await this.prisma.inventoryItem.findMany({
      include: { batches: true },
      orderBy: { name: 'asc' },
    });

    return items.map((item) => {
      const totalQuantity = item.batches.reduce((s, b) => s + b.quantity, 0);
      const nextExpiry =
        item.batches
          .filter((b) => b.expirationDate)
          .sort((a, b) => (a.expirationDate! < b.expirationDate! ? -1 : 1))[0]
          ?.expirationDate ?? null;

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        isPerishable: item.isPerishable,
        minReorderLevel: item.minReorderLevel,
        totalQuantity,
        nextExpiry,
        isLowStock: totalQuantity < item.minReorderLevel,
      };
    });
  }

  async listBatchesByItem(itemId: string) {
    return this.prisma.inventoryBatch.findMany({
      where: { itemId },
      orderBy: [{ expirationDate: 'asc' }, { receivedAt: 'asc' }],
    });
  }

  // ── Batches ────────────────────────────────────────────────────────────────

  async createBatch(dto: CreateBatchDto) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id: dto.itemId } });
    if (!item) throw new NotFoundException('Inventory item not found');

    const batch = await this.prisma.inventoryBatch.create({
      data: {
        itemId: dto.itemId,
        lotNumber: dto.lotNumber,
        quantity: dto.quantity,
        unitCost: dto.unitCost,
        expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : null,
      },
    });

    // After restocking, re-enable products whose ingredients are now sufficient
    await this.syncProductAvailabilityForItem(dto.itemId);

    return batch;
  }

  async adjustStock(dto: AdjustStockDto) {
    const batch = await this.prisma.inventoryBatch.findUnique({ where: { id: dto.batchId } });
    if (!batch) throw new NotFoundException('Batch not found');

    const newQty = batch.quantity - dto.quantity;
    if (newQty < 0) throw new BadRequestException('Insufficient stock in this batch');

    const [updatedBatch, adjustment] = await this.prisma.$transaction([
      this.prisma.inventoryBatch.update({
        where: { id: batch.id },
        data: { quantity: newQty },
      }),
      this.prisma.inventoryAdjustment.create({
        data: {
          batchId: batch.id,
          type: dto.type,
          quantity: dto.quantity,
          reason: dto.reason,
          cost: dto.cost,
        },
      }),
    ]);

    return { batch: updatedBatch, adjustment };
  }

  // ── FEFO deduction ─────────────────────────────────────────────────────────

  async deductByFEFO(itemId: string, quantity: number, type: 'USE' | 'SALE', reason?: string) {
    const batches = await this.prisma.inventoryBatch.findMany({
      where: { itemId, quantity: { gt: 0 } },
      orderBy: [{ expirationDate: 'asc' }, { receivedAt: 'asc' }],
    });

    let remaining = quantity;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, batch.quantity);
      remaining -= deduct;
      await this.prisma.$transaction([
        this.prisma.inventoryBatch.update({
          where: { id: batch.id },
          data: { quantity: batch.quantity - deduct },
        }),
        this.prisma.inventoryAdjustment.create({
          data: { batchId: batch.id, type, quantity: deduct, reason },
        }),
      ]);
    }

    if (remaining > 0) {
      throw new BadRequestException(`Insufficient stock for item ${itemId}: short by ${remaining}`);
    }
  }

  // ── Alerts ─────────────────────────────────────────────────────────────────

  async getAlerts() {
    const expiryDays = Number(this.config.get('EXPIRY_ALERT_DAYS') ?? 3) || 3;
    const expiryCutoff = new Date();
    expiryCutoff.setDate(expiryCutoff.getDate() + expiryDays);

    const items = await this.prisma.inventoryItem.findMany({ include: { batches: true } });

    const lowStockItems: { id: string; name: string; category: string; totalQuantity: number; minReorderLevel: number }[] = [];
    const expiringBatches: { id: string; itemId: string; itemName: string; lotNumber: string | null; quantity: number; expirationDate: Date }[] = [];

    for (const item of items) {
      const totalQuantity = item.batches.reduce((s, b) => s + b.quantity, 0);
      if (totalQuantity < item.minReorderLevel) {
        lowStockItems.push({ id: item.id, name: item.name, category: item.category, totalQuantity, minReorderLevel: item.minReorderLevel });
      }
      for (const batch of item.batches) {
        if (item.isPerishable && batch.expirationDate && batch.expirationDate <= expiryCutoff) {
          expiringBatches.push({
            id: batch.id, itemId: item.id, itemName: item.name,
            lotNumber: batch.lotNumber ?? null, quantity: batch.quantity,
            expirationDate: batch.expirationDate,
          });
        }
      }
    }

    return { lowStockItems, expiringBatches };
  }

  // ── Recipes ────────────────────────────────────────────────────────────────

  async getRecipe(productId: string) {
    return this.prisma.recipeItem.findMany({
      where: { productId },
      include: { inventoryItem: { select: { id: true, name: true, unit: true } } },
    });
  }

  async upsertRecipeItem(dto: CreateRecipeItemDto) {
    return this.prisma.recipeItem.upsert({
      where: { productId_inventoryItemId: { productId: dto.productId, inventoryItemId: dto.inventoryItemId } },
      create: { productId: dto.productId, inventoryItemId: dto.inventoryItemId, quantityPerUnit: dto.quantityPerUnit },
      update: { quantityPerUnit: dto.quantityPerUnit },
    });
  }

  async deleteRecipeItem(productId: string, inventoryItemId: string) {
    await this.prisma.recipeItem.deleteMany({ where: { productId, inventoryItemId } });
  }

  // ── Equipment ──────────────────────────────────────────────────────────────

  async createEquipment(dto: CreateEquipmentDto) {
    return this.prisma.equipment.create({
      data: {
        name: dto.name,
        serialNumber: dto.serialNumber,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        warrantyExpiryDate: dto.warrantyExpiryDate ? new Date(dto.warrantyExpiryDate) : null,
        maintenanceIntervalDays: dto.maintenanceIntervalDays ?? null,
      },
    });
  }

  async listEquipment() {
    const upcomingDays = Number(this.config.get('MAINTENANCE_ALERT_DAYS') ?? 7) || 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + upcomingDays);

    const equipment = await this.prisma.equipment.findMany({
      include: { maintenances: true },
      orderBy: { name: 'asc' },
    });

    return equipment.map((eq) => {
      const totalMaintenanceCost = eq.maintenances.reduce((s, m) => s + (m.cost ?? 0), 0);
      const upcomingMaintenance =
        eq.maintenances
          .filter((m) => m.nextDueDate && m.nextDueDate <= cutoff)
          .sort((a, b) => (a.nextDueDate! < b.nextDueDate! ? -1 : 1))[0] ?? null;
      return { ...eq, totalMaintenanceCost, upcomingMaintenance };
    });
  }

  async createMaintenance(dto: CreateMaintenanceDto) {
    return this.prisma.equipmentMaintenance.create({
      data: {
        equipmentId: dto.equipmentId,
        performedAt: dto.performedAt ? new Date(dto.performedAt) : new Date(),
        description: dto.description,
        cost: dto.cost,
        nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : null,
      },
    });
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  async getUsageReport(from: Date, to: Date) {
    const adjustments = await this.prisma.inventoryAdjustment.findMany({
      where: { type: { in: ['USE', 'SALE'] }, createdAt: { gte: from, lte: to } },
      include: { batch: { include: { item: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const byItem: Record<string, { itemName: string; unit: string; totalUsed: number; totalSold: number }> = {};
    for (const a of adjustments) {
      const id = a.batch.itemId;
      if (!byItem[id]) byItem[id] = { itemName: a.batch.item.name, unit: a.batch.item.unit, totalUsed: 0, totalSold: 0 };
      if (a.type === 'USE') byItem[id].totalUsed += a.quantity;
      if (a.type === 'SALE') byItem[id].totalSold += a.quantity;
    }

    return { from, to, byItem: Object.entries(byItem).map(([itemId, v]) => ({ itemId, ...v })) };
  }

  // ── Availability sync ──────────────────────────────────────────────────────

  /**
   * After stock changes for an inventoryItem, check all products that use it
   * in their recipe. Re-enables products whose ingredients are now sufficient.
   * Returns list of products whose availability changed.
   */
  async syncProductAvailabilityForItem(
    inventoryItemId: string,
  ): Promise<{ id: string; name: string; isAvailable: boolean }[]> {
    const recipeItems = await this.prisma.recipeItem.findMany({
      where: { inventoryItemId },
      select: { productId: true },
    });

    const productIds = [...new Set(recipeItems.map((r) => r.productId))];
    const changed: { id: string; name: string; isAvailable: boolean }[] = [];

    for (const productId of productIds) {
      const { canFulfill } = await this.computeProductAvailability(productId);
      const product = await this.prisma.product.findUnique({ where: { id: productId } });
      if (!product) continue;

      if (product.isAvailable !== canFulfill) {
        const updated = await this.prisma.product.update({
          where: { id: productId },
          data: { isAvailable: canFulfill },
        });
        changed.push({ id: updated.id, name: updated.name, isAvailable: updated.isAvailable });
      }
    }

    return changed;
  }

  /**
   * After an order is placed, deduct ingredients for each product sold via FEFO,
   * then disable any products that no longer have sufficient ingredients.
   * Returns products whose availability changed (for WebSocket broadcast).
   */
  async deductOrderIngredients(
    items: { productId: string; quantity: number }[],
  ): Promise<{ id: string; name: string; isAvailable: boolean }[]> {
    const changed: { id: string; name: string; isAvailable: boolean }[] = [];

    for (const item of items) {
      const recipe = await this.prisma.recipeItem.findMany({
        where: { productId: item.productId },
      });

      if (recipe.length === 0) continue;

      for (const ri of recipe) {
        const needed = ri.quantityPerUnit * item.quantity;
        try {
          await this.deductByFEFO(ri.inventoryItemId, needed, 'SALE', `Order: product ${item.productId}`);
        } catch {
          // Non-fatal — stock may have been manually adjusted
        }
      }

      const { canFulfill } = await this.computeProductAvailability(item.productId);
      const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) continue;

      if (product.isAvailable && !canFulfill) {
        const updated = await this.prisma.product.update({
          where: { id: item.productId },
          data: { isAvailable: false },
        });
        changed.push({ id: updated.id, name: updated.name, isAvailable: false });
      }
    }

    return changed;
  }

  /**
   * Check if a product can be fulfilled based on current inventory.
   * Products with no recipe are always considered fulfillable.
   */
  private async computeProductAvailability(productId: string): Promise<{ canFulfill: boolean }> {
    const recipe = await this.prisma.recipeItem.findMany({ where: { productId } });
    if (recipe.length === 0) return { canFulfill: true };

    for (const ri of recipe) {
      const batches = await this.prisma.inventoryBatch.findMany({ where: { itemId: ri.inventoryItemId } });
      const total = batches.reduce((s, b) => s + b.quantity, 0);
      if (total < ri.quantityPerUnit) return { canFulfill: false };
    }

    return { canFulfill: true };
  }
}
