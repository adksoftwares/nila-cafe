import { z } from 'zod';

const tableOrderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be at least 1').default(1),
  notes: z.string().optional().default(''),
  modifiers: z.array(z.any()).optional().default([])
});

export const holdTableSchema = z.object({
  tableNumber: z.string().min(1, 'Table number is required'),
  items: z.array(tableOrderItemSchema).min(1, 'At least one item is required'),
  discount: z.number().nonnegative().optional().default(0),
  customerId: z.string().nullable().optional()
});

export const transferTableSchema = z.object({
  fromTable: z.string().min(1, 'Source table is required'),
  toTable: z.string().min(1, 'Destination table is required')
});
