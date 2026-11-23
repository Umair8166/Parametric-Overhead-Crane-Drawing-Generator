import { z } from 'zod';
import {
  ALLOWED_CAPACITIES_T,
  type AllowedCapacityT,
  type DesignEvaluation,
  type DesignInput,
  type FieldMessage,
  evaluateDesign,
  validateDomainRules,
} from './rules.js';

/** Sanity bounds for API inputs (not structural engineering limits). */
export const INPUT_BOUNDS = {
  nameMinLen: 1,
  nameMaxLen: 80,
  spanMm: { min: 5000, max: 30000 },
  railHeightMm: { min: 3000, max: 15000 },
  liftHeightMm: { min: 1000, max: 15000 },
  buildingHeightMm: { min: 3000, max: 25000 },
  wallClearanceMm: { min: 100, max: 5000 },
} as const;

const intMm = (min: number, max: number, label: string) =>
  z
    .number({ error: `${label} must be a number (mm)` })
    .int({ error: `${label} must be a whole number of millimetres` })
    .min(min, { error: `${label} must be at least ${min} mm` })
    .max(max, { error: `${label} must be at most ${max} mm` });

const optionalIntMm = (min: number, max: number, label: string) =>
  z
    .union([intMm(min, max, label), z.null()])
    .optional()
    .transform((v): number | null => v ?? null);

/**
 * Layer 1 (Schema) validation for incoming crane design payloads.
 * Cross-field physical fit checks live in rules.ts.
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
  spanMm: intMm(INPUT_BOUNDS.spanMm.min, INPUT_BOUNDS.spanMm.max, 'Span'),
  railHeightMm: intMm(INPUT_BOUNDS.railHeightMm.min, INPUT_BOUNDS.railHeightMm.max, 'Rail height'),
  liftHeightMm: intMm(
    INPUT_BOUNDS.liftHeightMm.min,
    INPUT_BOUNDS.liftHeightMm.max,
    'Lifting height',
  ),
  buildingHeightMm: optionalIntMm(
    INPUT_BOUNDS.buildingHeightMm.min,
    INPUT_BOUNDS.buildingHeightMm.max,
    'Building clear height',
  ),
  wallClearanceMm: optionalIntMm(
    INPUT_BOUNDS.wallClearanceMm.min,
    INPUT_BOUNDS.wallClearanceMm.max,
    'Wall clearance',
  ),
});

export function parseDesignInput(
  payload: unknown,
): { ok: true; data: DesignInput } | { ok: false; errors: FieldMessage[] } {
  const result = designInputSchema.safeParse(payload);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  return {
    ok: false,
    errors: result.error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.map(String).join('.') : 'body',
      message: issue.message,
    })),
  };
}

export type ValidationResult =
  | { ok: true; input: DesignInput; evaluation: DesignEvaluation }
  | { ok: false; errors: FieldMessage[] };

/** Runs Layer 1 (Zod schema) then Layer 2 (domain fit rules), and computes outputs. */
export function validateAndEvaluateDesign(payload: unknown): ValidationResult {
  const parsed = parseDesignInput(payload);
  if (!parsed.ok) return parsed;

  const domainErrors = validateDomainRules(parsed.data);
  if (domainErrors.length > 0) {
    return { ok: false, errors: domainErrors };
  }

  return {
    ok: true,
    input: parsed.data,
    evaluation: evaluateDesign(parsed.data),
  };
}
