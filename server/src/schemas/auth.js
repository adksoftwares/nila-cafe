import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});

export const pinCheckSchema = z.object({
  pin: z.string().min(4, 'PIN must be at least 4 digits').max(8, 'PIN cannot exceed 8 digits')
});
