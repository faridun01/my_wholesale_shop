import { z } from 'zod';

const emptyToUndefined = <T>(schema: z.ZodType<T>) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), schema.optional());

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const positiveId = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
  z.number().int().positive(),
);

export const staffPeriodQuerySchema = z.object({
  start: emptyToUndefined(dateOnly),
  end: emptyToUndefined(dateOnly),
  warehouseId: positiveId.optional(),
});

export const staffIdParamSchema = z.object({
  id: positiveId,
});
