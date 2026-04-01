import { Controller, Get, Patch, Param } from '@nestjs/common';
import { KitchenService } from './kitchen.service';

/**
 * Kitchen Display Controller — NO AUTH REQUIRED.
 * Dedicated internal screen endpoint for kitchen staff.
 */
@Controller('kitchen')
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  // GET /api/kitchen/orders — active orders with assigned chef names
  @Get('orders')
  async getActiveOrders() {
    return this.kitchenService.getActiveOrders();
  }

  // GET /api/kitchen/chefs — all chefs with workload for roster panel
  @Get('chefs')
  async getKitchenChefs() {
    return this.kitchenService.getKitchenChefs();
  }

  // GET /api/kitchen/stats — order counts by status
  @Get('stats')
  async getStats() {
    return this.kitchenService.getStats();
  }

  // GET /api/kitchen/products — products requiring cooking
  @Get('products')
  async getKitchenProducts() {
    return this.kitchenService.getKitchenProducts();
  }

  // PATCH /api/kitchen/orders/:id/accept — PENDING → IN_PROGRESS
  @Patch('orders/:id/accept')
  async acceptOrder(@Param('id') id: string) {
    return this.kitchenService.acceptOrder(id);
  }

  // PATCH /api/kitchen/orders/:id/done — IN_PROGRESS → DONE
  @Patch('orders/:id/done')
  async markDone(@Param('id') id: string) {
    return this.kitchenService.markDone(id);
  }
}
