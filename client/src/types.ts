export const ALLOWED_CAPACITIES_T = [1, 2, 3.2, 5, 6.3, 8, 10, 12.5, 16] as const;

export interface DesignInput {
  name: string;
  capacityT: number;
  spanMm: number;
  railHeightMm: number;
  liftHeightMm: number;
  buildingHeightMm: number | null;
  wallClearanceMm: number | null;
}

export interface FormValues {
  name: string;
  capacityT: string;
  spanMm: string;
  railHeightMm: string;
  liftHeightMm: string;
  buildingHeightMm: string;
  wallClearanceMm: string;
}

export interface FieldMessage {
  field: string;
  message: string;
}

export type Provenance = 'user_input' | 'reference_drawing' | 'derived' | 'estimate';

export interface DimensionItem {
  key: string;
  label: string;
  value: number;
  unit: 'mm' | 't';
  provenance: Provenance;
  source: string;
}

export interface DesignEvaluation {
  craneType: string;
  rulesVersion: string;
  isExtrapolated: boolean;
  derived: Record<string, number | null>;
  dimensions: DimensionItem[];
  warnings: FieldMessage[];
  disclaimer: string;
}

export interface PreviewResponse {
  input: DesignInput;
  evaluation: DesignEvaluation;
  svg: string;
}

export interface DesignDetail extends PreviewResponse {
  id: number;
  rulesVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface DesignSummary {
  id: number;
  name: string;
  capacityT: number;
  spanMm: number;
  railHeightMm: number;
  liftHeightMm: number;
  rulesVersion: string;
  updatedAt: string;
}

/** Matches page 4 reference drawing (10 t, 25 000 mm span, 8 321 mm rail, 7 900 mm lift). */
export const REFERENCE_FORM_VALUES: FormValues = {
  name: '10t-25m-7.9m',
  capacityT: '10',
  spanMm: '25000',
  railHeightMm: '8321',
  liftHeightMm: '7900',
  buildingHeightMm: '9890',
  wallClearanceMm: '235',
};

export function inputToFormValues(input: DesignInput): FormValues {
  return {
    name: input.name,
    capacityT: String(input.capacityT),
    spanMm: String(input.spanMm),
    railHeightMm: String(input.railHeightMm),
    liftHeightMm: String(input.liftHeightMm),
    buildingHeightMm: input.buildingHeightMm === null ? '' : String(input.buildingHeightMm),
    wallClearanceMm: input.wallClearanceMm === null ? '' : String(input.wallClearanceMm),
  };
}

function parseRequiredNum(raw: string): number | string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isNaN(n) ? trimmed : n;
}

function parseOptionalNum(raw: string): number | string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isNaN(n) ? trimmed : n;
}

/** Converts form strings to JSON payload; leaves validation to the server API. */
export function formValuesToPayload(values: FormValues): Record<string, unknown> {
  return {
    name: values.name,
    capacityT: parseRequiredNum(values.capacityT),
    spanMm: parseRequiredNum(values.spanMm),
    railHeightMm: parseRequiredNum(values.railHeightMm),
    liftHeightMm: parseRequiredNum(values.liftHeightMm),
    buildingHeightMm: parseOptionalNum(values.buildingHeightMm),
    wallClearanceMm: parseOptionalNum(values.wallClearanceMm),
  };
}
