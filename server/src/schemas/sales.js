import { z } from 'zod';

const modifierItemSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  price: z.number().nonnegative().default(0),
  ingredient_id: z.string().nullable().optional(),
  ingredient_qty: z.number().nonnegative().optional()
});

const saleItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be at least 1').default(1),
  discount: z.number().nonnegative().optional().default(0),
  notes: z.string().optional().default(''),
  modifiers: z.array(modifierItemSchema).optional().default([])
});

const paymentTenderSchema = z.object({
  method: z.enum(['cash', 'card', 'qr']),
  amount: z.number().positive('Payment amount must be greater than zero'),
  reference: z.string().nullable().optional()
});

export const checkoutSchema = z.object({
  orderType: z.enum(['takeaway', 'delivery', 'dining'], {
    errorMap: () => ({ message: "Order type must be 'takeaway', 'delivery', or 'dining'" })
  }),
  tableNumber: z.string().nullable().optional(),
  items: z.array(saleItemSchema).min(1, 'At least one order item is required'),
  discount: z.number().nonnegative('Discount cannot be negative').optional().default(0),
  customerId: z.string().nullable().optional(),
  pointsRedeemed: z.number().int().nonnegative().optional().default(0),
  promotionCode: z.string().nullable().optional(),
  payments: z.array(paymentTenderSchema).optional(),
  paymentMethod: z.enum(['cash', 'card', 'qr']).optional(),
  amountReceived: z.number().nonnegative().optional()
});

export const voidSaleSchema = z.object({
  reason: z.string().min(3, 'Void reason must be at least 3 characters long'),
  managerPin: z.string().optional()
});
