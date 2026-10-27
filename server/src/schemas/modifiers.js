import { z } from 'zod';

const modifierOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Option name is required'),
  price: z.number().nonnegative('Price cannot be negative').default(0),
  ingredient_id: z.string().nullable().optional(),
  ingredient_qty: z.number().nonnegative().optional().default(0)
});

export const createModifierSchema = z.object({
  productId: z.string().nullable().optional(),
  name: z.string().trim().min(1, 'Modifier group name is required'),
  type: z.enum(['single', 'multiple'], {
    errorMap: () => ({ message: "Type must be either 'single' or 'multiple'" })
  }).default('single'),
  required: z.boolean().optional().default(false),
  options: z.array(modifierOptionSchema).min(1, 'At least one modifier option is required')
});

export const updateModifierSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['single', 'multiple']).optional(),
  required: z.boolean().optional(),
  options: z.array(modifierOptionSchema).min(1).optional(),
  active: z.boolean().optional()
});
