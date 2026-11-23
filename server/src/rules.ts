/**
 * Pure crane engineering rules and calculations (zero external dependencies).
 *
 * All crane-side constants come from a single attached reference drawing
 * (page 4: single-girder top-running EOT crane, 10 t, 25 000 mm span,
 * 7 900 mm lift, 8 321 mm rail height). When user inputs move away from
 * 10 t / 25 000 mm, crane-dependent outputs are explicitly tagged as estimates.
 */

export const RULES_VERSION = 'ref-10t-25m-v1';
export const CRANE_TYPE = 'Single-girder, top-running EOT crane';
export const PRELIMINARY_DISCLAIMER =
  'PRELIMINARY OFFER DRAWING — NOT FOR CONSTRUCTION. Crane geometry is based on a single 10 t / 25 m reference drawing; extrapolated dimensions are estimates.';

/**
 * Standard metric hoist capacity steps (tonnes) up to a 16 t estimate ceiling
 * for single-girder cranes. Reference drawing is 10 t.
 */
export const ALLOWED_CAPACITIES_T = [1, 2, 3.2, 5, 6.3, 8, 10, 12.5, 16] as const;
export type AllowedCapacityT = (typeof ALLOWED_CAPACITIES_T)[number];

/** Sourced constants extracted or directly derived from page 4 of the brief. */
export const REFERENCE = {
  // Baseline crane shown on page 4
  capacityT: 10,
  spanMm: 25000,
  railHeightMm: 8321,
  liftHeightMm: 7900,
  buildingHeightMm: 9890, // R2: 8321 + 1569

  // Vertical clearances (p.4 Front Elevation)
  craneHeightAboveRailMm: 1369, // rail top -> girder top
  roofClearanceMm: 200, // girder top -> roof underside
  headroomAboveRailMm: 1569, // R1: 1369 + 200 (matches drawing)
  hookBelowGirderMm: 620, // datum interpreted as girder underside -> highest hook
  girderUndersideAboveRailMm: 199, // R4: 7900 + 620 - 8321 (depends on 620 datum)
  liftLossMm: 421, // R5: 620 - 199 (reproduces 8321 - 421 = 7900)

  // Horizontal clearances (p.4 Front Elevation & Plan View)
  hookApproachLeftMm: 920, // Min.920 (left rail CL -> hook CL)
  hookApproachRightMm: 1150, // Min.1150 (right rail CL -> hook CL, asymmetric hoist)
  endCarriageOverhangMm: 135, // R6: (25270 overall bridge - 25000 span) / 2
  minWallClearanceMm: 235, // Min.235 (rail CL -> wall face, ~100 mm gap to crane end)
} as const;

export interface DesignInput {
  name: string;
  capacityT: AllowedCapacityT;
  spanMm: number;
  railHeightMm: number;
  liftHeightMm: number;
  buildingHeightMm: number | null;
  wallClearanceMm: number | null;
}

/** Default inputs equal the reference drawing (doubles as our golden test). */
export const DEFAULT_DESIGN_INPUT: DesignInput = {
  name: '10t-25m-7.9m',
  capacityT: REFERENCE.capacityT,
  spanMm: REFERENCE.spanMm,
  railHeightMm: REFERENCE.railHeightMm,
  liftHeightMm: REFERENCE.liftHeightMm,
  buildingHeightMm: REFERENCE.buildingHeightMm,
  wallClearanceMm: REFERENCE.minWallClearanceMm,
};

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

export interface DerivedDimensions {
  craneTopElevationMm: number;
  requiredBuildingHeightMm: number;
  effectiveBuildingHeightMm: number;
  actualRoofClearanceMm: number;
  roofHeadroomMarginMm: number | null;
  girderUndersideElevationMm: number;
  maxLiftHeightMm: number;
  liftMarginMm: number;
  hookCoverageMm: number;
  overallBridgeLengthMm: number;
  effectiveWallClearanceMm: number;
  endToWallGapMm: number;
}

export interface DesignEvaluation {
  craneType: string;
  rulesVersion: string;
  isExtrapolated: boolean;
  derived: DerivedDimensions;
  dimensions: DimensionItem[];
  warnings: FieldMessage[];
  disclaimer: string;
}

/**
 * Layer 2 (Domain) validation: blocking cross-field physical fit checks.
 */
export function validateDomainRules(input: DesignInput): FieldMessage[] {
  const errors: FieldMessage[] = [];

  const minSpan = REFERENCE.hookApproachLeftMm + REFERENCE.hookApproachRightMm;
  if (input.spanMm <= minSpan) {
    errors.push({
      field: 'spanMm',
      message: `Span (${input.spanMm} mm) must exceed combined left + right hook approaches (${minSpan} mm).`,
    });
  }

  // Rule R5: liftHeightMm <= railHeightMm - 421
  const maxLift = input.railHeightMm - REFERENCE.liftLossMm;
  if (input.liftHeightMm > maxLift) {
    errors.push({
      field: 'liftHeightMm',
      message: `Lifting height (${input.liftHeightMm} mm) exceeds maximum achievable lift of ${maxLift} mm (rail height − ${REFERENCE.liftLossMm} mm, rule R5).`,
    });
  }

  // Rule R2: buildingHeightMm >= railHeightMm + 1569 (when provided)
  if (input.buildingHeightMm !== null) {
    const minBuilding = input.railHeightMm + REFERENCE.headroomAboveRailMm;
    if (input.buildingHeightMm < minBuilding) {
      errors.push({
        field: 'buildingHeightMm',
        message: `Building clear height (${input.buildingHeightMm} mm) is below the minimum ${minBuilding} mm required (rail + ${REFERENCE.craneHeightAboveRailMm} mm crane + ${REFERENCE.roofClearanceMm} mm roof clearance, rules R1/R2).`,
      });
    }
  }

  // Minimum side clearance from rail centreline to wall face (p.4 Min.235)
  if (input.wallClearanceMm !== null && input.wallClearanceMm < REFERENCE.minWallClearanceMm) {
    errors.push({
      field: 'wallClearanceMm',
      message: `Wall clearance (${input.wallClearanceMm} mm) is below the minimum ${REFERENCE.minWallClearanceMm} mm required from rail centreline to wall face (reference drawing Min.235).`,
    });
  }

  return errors;
}

/** Non-blocking warnings when inputs go outside the 10 t / 25 m reference envelope. */
export function collectWarnings(input: DesignInput): FieldMessage[] {
  const warnings: FieldMessage[] = [];

  if (input.capacityT !== REFERENCE.capacityT) {
    warnings.push({
      field: 'capacityT',
      message: `Hoist and crane clearances (1369 / 620 / 920 / 1150 mm) are fixed from the 10 t reference drawing. For a ${input.capacityT} t crane these are estimates only.`,
    });
  }

  if (input.spanMm > REFERENCE.spanMm) {
    warnings.push({
      field: 'spanMm',
      message: `Span (${input.spanMm} mm) exceeds the 25000 mm reference crane. A longer girder is typically deeper, so required headroom (1569 mm) may be underestimated.`,
    });
  }

  return warnings;
}

const dim = (
  key: string,
  label: string,
  value: number,
  unit: 'mm' | 't',
  provenance: Provenance,
  source: string,
): DimensionItem => ({ key, label, value, unit, provenance, source });

/** Pure calculation: computes derived geometry, provenance list, and warnings. */
export function evaluateDesign(input: DesignInput): DesignEvaluation {
  const isExtrapolated =
    input.capacityT !== REFERENCE.capacityT || input.spanMm !== REFERENCE.spanMm;
  const refTag: Provenance = isExtrapolated ? 'estimate' : 'reference_drawing';
  const drvTag: Provenance = isExtrapolated ? 'estimate' : 'derived';
  const ext = isExtrapolated ? ' (estimate from 10 t / 25 m ref)' : '';

  const craneTopElevationMm = input.railHeightMm + REFERENCE.craneHeightAboveRailMm;
  const requiredBuildingHeightMm = input.railHeightMm + REFERENCE.headroomAboveRailMm;
  const effectiveBuildingHeightMm = input.buildingHeightMm ?? requiredBuildingHeightMm;
  const actualRoofClearanceMm = effectiveBuildingHeightMm - craneTopElevationMm;
  const roofHeadroomMarginMm =
    input.buildingHeightMm !== null ? input.buildingHeightMm - requiredBuildingHeightMm : null;
  const girderUndersideElevationMm = input.railHeightMm + REFERENCE.girderUndersideAboveRailMm;
  const maxLiftHeightMm = input.railHeightMm - REFERENCE.liftLossMm;
  const liftMarginMm = maxLiftHeightMm - input.liftHeightMm;
  const hookCoverageMm =
    input.spanMm - REFERENCE.hookApproachLeftMm - REFERENCE.hookApproachRightMm;
  const overallBridgeLengthMm = input.spanMm + 2 * REFERENCE.endCarriageOverhangMm;
  const effectiveWallClearanceMm = input.wallClearanceMm ?? REFERENCE.minWallClearanceMm;
  const endToWallGapMm = effectiveWallClearanceMm - REFERENCE.endCarriageOverhangMm;

  const derived: DerivedDimensions = {
    craneTopElevationMm,
    requiredBuildingHeightMm,
    effectiveBuildingHeightMm,
    actualRoofClearanceMm,
    roofHeadroomMarginMm,
    girderUndersideElevationMm,
    maxLiftHeightMm,
    liftMarginMm,
    hookCoverageMm,
    overallBridgeLengthMm,
    effectiveWallClearanceMm,
    endToWallGapMm,
  };

  const dimensions: DimensionItem[] = [
    dim('capacityT', 'Rated Capacity', input.capacityT, 't', 'user_input', 'User input'),
    dim('spanMm', 'Span (rail CL to rail CL)', input.spanMm, 'mm', 'user_input', 'User input'),
    dim('railHeightMm', 'Rail Height (floor to rail top)', input.railHeightMm, 'mm', 'user_input', 'User input'),
    dim('liftHeightMm', 'Requested Lifting Height', input.liftHeightMm, 'mm', 'user_input', 'User input'),
    dim('craneHeightAboveRailMm', 'Crane Height Above Rail', REFERENCE.craneHeightAboveRailMm, 'mm', refTag, `Ref p.4: 1369${ext}`),
    dim('roofClearanceMm', 'Minimum Roof Clearance', REFERENCE.roofClearanceMm, 'mm', 'reference_drawing', 'Ref p.4: 200'),
    dim('headroomAboveRailMm', 'Required Headroom Above Rail', REFERENCE.headroomAboveRailMm, 'mm', drvTag, `R1: 1369 + 200${ext}`),
    dim('craneTopElevationMm', 'Crane Top Elevation', craneTopElevationMm, 'mm', drvTag, `R3: rail + 1369${ext}`),
    dim('requiredBuildingHeightMm', 'Min. Building Clear Height', requiredBuildingHeightMm, 'mm', drvTag, `R2: rail + 1569${ext}`),
    dim(
      'effectiveBuildingHeightMm',
      input.buildingHeightMm !== null ? 'Building Clear Height (provided)' : 'Building Clear Height (min. required)',
      effectiveBuildingHeightMm,
      'mm',
      input.buildingHeightMm !== null ? 'user_input' : drvTag,
      input.buildingHeightMm !== null ? 'User input' : `Defaulted to R2${ext}`,
    ),
    dim('hookBelowGirderMm', 'Hook Below Girder (highest)', REFERENCE.hookBelowGirderMm, 'mm', refTag, `Ref p.4: 620 (datum interpreted)${ext}`),
    dim('maxLiftHeightMm', 'Max. Achievable Lift Height', maxLiftHeightMm, 'mm', 'estimate', `R5: rail − 421 (depends on 620 datum)${ext}`),
    dim('hookApproachLeftMm', 'Min. Hook Approach (Left)', REFERENCE.hookApproachLeftMm, 'mm', refTag, `Ref p.4: Min.920${ext}`),
    dim('hookApproachRightMm', 'Min. Hook Approach (Right)', REFERENCE.hookApproachRightMm, 'mm', refTag, `Ref p.4: Min.1150 (asymmetric)${ext}`),
    dim('hookCoverageMm', 'Hook Coverage Across Span', hookCoverageMm, 'mm', drvTag, `R8: span − 920 − 1150${ext}`),
    dim('overallBridgeLengthMm', 'Overall Bridge Length', overallBridgeLengthMm, 'mm', drvTag, `R6: span + 2 × 135${ext}`),
    dim(
      'effectiveWallClearanceMm',
      input.wallClearanceMm !== null ? 'Wall Clearance (provided, per side)' : 'Min. Wall Clearance (per side)',
      effectiveWallClearanceMm,
      'mm',
      input.wallClearanceMm !== null ? 'user_input' : refTag,
      input.wallClearanceMm !== null ? 'User input (symmetric)' : `Ref p.4: Min.235${ext}`,
    ),
    dim('endToWallGapMm', 'Crane End to Wall Gap (per side)', endToWallGapMm, 'mm', drvTag, `R7: wallClearance − 135${ext}`),
  ];

  return {
    craneType: CRANE_TYPE,
    rulesVersion: RULES_VERSION,
    isExtrapolated,
    derived,
    dimensions,
    warnings: collectWarnings(input),
    disclaimer: PRELIMINARY_DISCLAIMER,
  };
}
