import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PosService } from './services/pos.service';
import { BillService } from './services/bill.service';
import { NotificationService } from './services/notification.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateOrderSchema } from './dto/create-order.schema';
import { OrderRepository } from './repositories/order.repository';

type OrderItemWithProduct = {
  productId: string;
  quantity: number;
  price: number;
  product?: { name: string };
};

function posResponse<T>(data: T, message?: string) {
  return { success: true, data, ...(message ? { message } : {}) };
}

function posError(message: string, errors?: unknown) {
  return { success: false, message, ...(errors ? { errors } : {}) };
}

@Controller('pos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CASHIER', 'ADMIN')
export class PosController {
  constructor(
    private readonly posService: PosService,
    private readonly billService: BillService,
    private readonly notificationService: NotificationService,
    private readonly orderRepo: OrderRepository,
  ) {}

  // GET /api/pos/customer?phone=XXXXXXXXXX
  @Get('customer')
  async lookupCustomer(@Query('phone') phone: string) {
    if (!phone || phone.trim() === '') {
      throw new BadRequestException(posError('phone query parameter is required'));
    }
    const result = await this.posService.lookupCustomerByPhone(phone.trim());
    return posResponse(result);
  }

  // GET /api/pos/products
  @Get('products')
  async getProducts() {
    const products = await this.posService.getProducts();
    return posResponse(products);
  }

  // GET /api/pos/chefs
  @Get('chefs')
  async getChefs() {
    const chefs = await this.posService.getChefs();
    return posResponse(chefs);
  }

  // GET /api/pos/orders
  @Get('orders')
  async getOrders() {
    const orders = await this.orderRepo.findAll();
    return posResponse(orders);
  }

  // POST /api/pos/orders
  @Post('orders')
  async createOrder(@Body() body: unknown) {
    const parsed = CreateOrderSchema.safeParse(body);

    if (!parsed.success) {
      const formatted = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      throw new BadRequestException(posError('Validation failed', formatted));
    }

    const order = await this.posService.createOrder(parsed.data);

    // ── Generate PDF bill ──────────────────────────────────────────────────
    const pdfBuffer = await this.billService.generatePdf({
      orderId: order.id,
      createdAt: order.createdAt,
      customer: order.customer,
      items: (order.items as OrderItemWithProduct[]).map((item) => ({
        name: item.product?.name ?? `Product ${item.productId}`,
        quantity: item.quantity,
        price: item.price,
      })),
      subtotal: order.subtotal,
      discount: order.discount,
      total: order.total,
      paymentMethod: order.paymentMethod,
    });

    // ── Send email + SMS notifications (non-blocking, errors are logged) ───
    void this.notificationService.sendOrderNotifications({
      customer: order.customer as { name: string; phone: string; email?: string | null },
      orderId: order.id,
      total: order.total,
      paymentMethod: order.paymentMethod,
      pdfBuffer,
    });

    return posResponse(order, 'Order created successfully');
  }

  // GET /api/pos/orders/:id/bill  — download PDF receipt
  @Get('orders/:id/bill')
  async downloadBill(@Param('id') id: string, @Res() res: Response) {
    const order = await this.orderRepo.findById(id);

    if (!order) {
      throw new NotFoundException(posError(`Order ${id} not found`));
    }

    const pdfBuffer = await this.billService.generatePdf({
      orderId: order.id,
      createdAt: order.createdAt,
      customer: order.customer as { id: string; name: string; phone: string },
      items: (order.items as OrderItemWithProduct[]).map((item) => ({
        name: item.product?.name ?? `Product ${item.productId}`,
        quantity: item.quantity,
        price: item.price,
      })),
      subtotal: order.subtotal,
      discount: order.discount,
      total: order.total,
      paymentMethod: order.paymentMethod,
    });

    const filename = `receipt-${order.id.slice(0, 8)}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}
