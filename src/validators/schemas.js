import { z } from 'zod';

/** Login / register credentials */
export const credentials = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
});

/** User creation (admin only) */
export const createUser = credentials.extend({
  role: z.enum(['admin', 'clinician', 'customer']),
});

/** Patient health profile */
export const profileSchema = z.object({
  fullName: z.string().min(1).max(120),
  age: z.number().int().min(0).max(130),
  sex: z.string().max(40),
  symptoms: z.array(z.string().max(300)).default([]),
  conditions: z.array(z.string().max(150)).default([]),
  allergies: z.array(z.string().max(150)).default([]),
  medications: z
    .array(
      z.object({
        name: z.string().max(150),
        dose: z.string().max(100).optional(),
        frequency: z.string().max(100).optional(),
      }),
    )
    .default([]),
});

/** Create patient request body */
export const createPatient = z.object({
  profile: profileSchema,
  ownerUserId: z.string().uuid(),
});

/** Process report request body */
export const processReport = z.object({
  text: z.string().min(1).max(100000),
  reportDate: z.string().date().optional(),
  sourceLabel: z.string().max(120).optional(),
});
