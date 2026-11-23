import { z } from 'zod';

/**
 * Standard metric single-girder EOT crane hoist capacities (tonnes).
 * Assumption: typical catalog capacity progression up to 16 t ceiling for
 * single-girder cranes. Reference drawing is 10 t.
 */
export const ALLOWED_CAPACITIES_T = [1, 2, 3.2, 5, 6.3, 8, 10, 12.5, 16] as const;
export type AllowedCapacityT = (typeof ALLOWED_CAPACITIES_T)[number];

/**
 * Sanity bounds for user inputs (not structural engineering limits).
 * All lengths are whole millimetres to match the reference drawing.
 */
export const INPUT_BOUNDS = {
  nameMinLen: 1,
  nameMaxLen: 80,
  spanMm: { min: 5000, max: 30000 },
  railHeightMm: { min: 3000, max: 15000 },
  liftHeightMm: { min: 1000, max: 15000 },
  buildingHeightMm: { min: 3000, max: 25000 },
  wallClearanceMm: { min: 100, max: 5000 },
} as const;

export interface ValidationIssue {
  field: string;
  code: string;
  message: string;
}

const optionalNullableInt = (min: number, max: number, label: string) =>
  z
    .union([
      z
        .number({ error: `${label} must be a number (mm)` })
        .int({ error: `${label} must be a whole number of millimetres` })
        .min(min, { error: `${label} must be at least ${min} mm` })
        .max(max, { error: `${label} must be at most ${max} mm` }),
      z.null(),
    ])
    .optional()
    .transform((v): number | null => (v === undefined ? null : v));

/**
 * Layer 1 (Schema) validation for crane design inputs.
 * Cross-field engineering feasibility rules live in rules.ts so they stay
 * decoupled, source-annotated, and independently unit-testable.
 */
export const designInputSchema = z.object({
  name: z
    .string({ error: 'Design name must be text' })
    .trim()
    .min(INPUT_BOUNDS.nameMinLen, { error: 'Design name is required' })
    .max(INPUT_BOUNDS.nameMaxLen, {
      error: `Design name must be at most ${INPUT_BOUNDS.nameMaxLen} characters`,
    }),
  capacityT: z
    .number({ error: 'Capacity must be a number (tonnes)' })
    .refine((v): v is AllowedCapacityT => (ALLOWED_CAPACITIES_T as readonly number[]).includes(v), {
      error: `Capacity must be one of: ${ALLOWED_CAPACITIES_T.join(', ')} t`,
    }),
  spanMm: z
    .number({ error: 'Span must be a number (mm)' })
    .int({ error: 'Span must be a whole number of millimetres' })
    .min(INPUT_BOUNDS.spanMm.min, { error: `Span must be at least ${INPUT_BOUNDS.spanMm.min} mm` })
    .max(INPUT_BOUNDS.spanMm.max, { error: `Span must be at most ${INPUT_BOUNDS.spanMm.max} mm` }),
  railHeightMm: z
    .number({ error: 'Rail height must be a number (mm)' })
    .int({ error: 'Rail height must be a whole number of millimetres' })
    .min(INPUT_BOUNDS.railHeightMm.min, {
      error: `Rail height must be at least ${INPUT_BOUNDS.railHeightMm.min} mm`,
    })
    .max(INPUT_BOUNDS.railHeightMm.max, {
      error: `Rail height must be at most ${INPUT_BOUNDS.railHeightMm.max} mm`,
    }),
  liftHeightMm: z
    .number({ error: 'Lifting height must be a number (mm)' })
    .int({ error: 'Lifting height must be a whole number of millimetres' })
    .min(INPUT_BOUNDS.liftHeightMm.min, {
      error: `Lifting height must be at least ${INPUT_BOUNDS.liftHeightMm.min} mm`,
    })
    .max(INPUT_BOUNDS.liftHeightMm.max, {
      error: `Lifting height must be at most ${INPUT_BOUNDS.liftHeightMm.max} mm`,
    }),
  buildingHeightMm: optionalNullableInt(
    INPUT_BOUNDS.buildingHeightMm.min,
    INPUT_BOUNDS.buildingHeightMm.max,
    'Building clear height',
  ),
  wallClearanceMm: optionalNullableInt(
    INPUT_BOUNDS.wallClearanceMm.min,
    INPUT_BOUNDS.wallClearanceMm.max,
    'Wall clearance',
  ),
});

export type DesignInput = z.infer<typeof designInputSchema>;

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; issues: ValidationIssue[] };

export function parseDesignInput(payload: unknown): ParseResult<DesignInput> {
  const result = designInputSchema.safeParse(payload);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.map(String).join('.') : 'body',
    code: 'SCHEMA_INVALID',
    message: issue.message,
  }));

  return { ok: false, issues };
}
