import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PosService } from './services/pos.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateOrderSchema } from './dto/create-order.schema';

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
  constructor(private readonly posService: PosService) {}

  // GET /api/pos/customer?phone=XXXXXXXXXX
  @Get('customer')
  async lookupCustomer(@Query('phone') phone: string) {
    if (!phone || phone.trim() === '') {
      throw new BadRequestException(
        posError('phone query parameter is required'),
      );
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

  // POST /api/pos/orders
  @Post('orders')
  async createOrder(@Body() body: unknown) {
    const parsed = CreateOrderSchema.safeParse(body);

    if (!parsed.success) {
      const formatted = parsed.error.issues.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      throw new BadRequestException(posError('Validation failed', formatted));
    }

    const order = await this.posService.createOrder(parsed.data);
    return posResponse(order, 'Order created successfully');
  }
}
