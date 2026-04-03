import {
  Body, Controller, Delete, Get, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { InventoryService } from './inventory.service';
import {
  CreateInventoryItemDto,
  CreateBatchDto,
  AdjustStockDto,
  CreateEquipmentDto,
  CreateMaintenanceDto,
  CreateRecipeItemDto,
} from './dto/inventory.dto';

function ok<T>(data: T, message?: string) {
  return { success: true, data, ...(message ? { message } : {}) };
}

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ── Items ──────────────────────────────────────────────────────────────────

  @Get('items')
  @Roles('ADMIN', 'CASHIER')
  async listItems() {
    return ok(await this.inventoryService.listItems());
  }

  @Post('items')
  @Roles('ADMIN')
  async createItem(@Body() dto: CreateInventoryItemDto) {
    return ok(await this.inventoryService.createItem(dto), 'Item created');
  }

  @Get('items/:itemId/batches')
  @Roles('ADMIN', 'CASHIER')
  async listBatches(@Param('itemId') itemId: string) {
    return ok(await this.inventoryService.listBatchesByItem(itemId));
  }

  // ── Batches ────────────────────────────────────────────────────────────────

  @Post('batches')
  @Roles('ADMIN')
  async createBatch(@Body() dto: CreateBatchDto) {
    return ok(await this.inventoryService.createBatch(dto), 'Batch added');
  }

  @Post('batches/adjust')
  @Roles('ADMIN')
  async adjustStock(@Body() dto: AdjustStockDto) {
    return ok(await this.inventoryService.adjustStock(dto), 'Stock adjusted');
  }

  // ── Alerts ─────────────────────────────────────────────────────────────────

  @Get('alerts')
  @Roles('ADMIN', 'CASHIER')
  async getAlerts() {
    return ok(await this.inventoryService.getAlerts());
  }

  // ── Recipes ────────────────────────────────────────────────────────────────

  @Get('recipes/:productId')
  @Roles('ADMIN', 'CASHIER')
  async getRecipe(@Param('productId') productId: string) {
    return ok(await this.inventoryService.getRecipe(productId));
  }

  @Post('recipes')
  @Roles('ADMIN')
  async upsertRecipeItem(@Body() dto: CreateRecipeItemDto) {
    return ok(await this.inventoryService.upsertRecipeItem(dto), 'Recipe item saved');
  }

  @Delete('recipes/:productId/:inventoryItemId')
  @Roles('ADMIN')
  async deleteRecipeItem(
    @Param('productId') productId: string,
    @Param('inventoryItemId') inventoryItemId: string,
  ) {
    await this.inventoryService.deleteRecipeItem(productId, inventoryItemId);
    return ok(null, 'Recipe item removed');
  }

  // ── Equipment ──────────────────────────────────────────────────────────────

  @Get('equipment')
  @Roles('ADMIN', 'CASHIER')
  async listEquipment() {
    return ok(await this.inventoryService.listEquipment());
  }

  @Post('equipment')
  @Roles('ADMIN')
  async createEquipment(@Body() dto: CreateEquipmentDto) {
    return ok(await this.inventoryService.createEquipment(dto), 'Equipment added');
  }

  @Post('equipment/maintenance')
  @Roles('ADMIN')
  async createMaintenance(@Body() dto: CreateMaintenanceDto) {
    return ok(await this.inventoryService.createMaintenance(dto), 'Maintenance logged');
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  @Get('reports/usage')
  @Roles('ADMIN')
  async getUsageReport(@Query('from') from?: string, @Query('to') to?: string) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();
    return ok(await this.inventoryService.getUsageReport(fromDate, toDate));
  }
}
