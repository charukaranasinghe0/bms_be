import { z } from 'zod';

export const OrderItemSchema = z.object({
  productId: z.string().uuid({ message: 'productId must be a valid UUID' }),
  quantity: z.number().int().min(1, { message: 'quantity must be at least 1' }),
  assignedChefId: z.string().uuid({ message: 'assignedChefId must be a valid UUID' }).optional(),
});

export const CreateOrderSchema = z.object({
  customerId: z.string().uuid({ message: 'customerId must be a valid UUID' }),
  items: z.array(OrderItemSchema).min(1, { message: 'Order must contain at least one item' }),
  discount: z.number().min(0).max(100).default(0),
  paymentMethod: z.enum(['CASH', 'CARD'] as const, {
    error: 'paymentMethod must be CASH or CARD',
  }),
});

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;
