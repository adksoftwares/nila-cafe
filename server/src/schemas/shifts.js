import { z } from 'zod';

export const openShiftSchema = z.object({
  openingFloat: z.number().nonnegative('Opening float cannot be negative').default(0),
  notes: z.string().optional().default('')
});

export const shiftAdjustmentSchema = z.object({
  type: z.enum(['cash_in', 'cash_out'], {
    errorMap: () => ({ message: "Adjustment type must be either 'cash_in' or 'cash_out'" })
  }),
  amount: z.number().positive('Adjustment amount must be greater than zero'),
  reason: z.string().min(3, 'Adjustment reason must be at least 3 characters long')
});

export const closeShiftSchema = z.object({
  actualCash: z.number().nonnegative('Counted cash drawer amount cannot be negative'),
  notes: z.string().optional().default('')
});
