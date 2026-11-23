import {
  ALLOWED_CAPACITIES_T,
  type DesignInput,
  type ValidationIssue,
  parseDesignInput,
} from './validation.js';

/**
 * Stored with every saved design so historical designs remain explainable
 * if crane rules or reference catalogs are updated later.
 */
export const RULES_VERSION = 'ref-10t-25m-v1';

export const CRANE_TYPE = 'Single-girder, top-running EOT crane';

/**
 * Constants extracted from (or derived directly from) the attached reference
 * drawing (page 4: 10 t capacity, 25 000 mm span, 7 900 mm lifting height,
 * 8 321 mm rail height).
 *
 * Every constant carries its source. Using these numbers for capacities or
 * spans other than 10 t / 25 000 mm is an extrapolation and is flagged as an
 * estimate in the API output and on the drawing.
 */
export const REFERENCE = {
  /** Reference crane rated capacity (p.4 Technical Data: LOAD 10t). */
  capacityT: 10,
  /** Reference crane rail-centreline span (p.4 Front Elevation: 25000). */
  spanMm: 25000,
  /** Reference floor-to-rail-top elevation (p.4 Front Elevation: 8321). */
  railHeightMm: 8321,
  /** Reference floor-to-highest-hook lifting height (p.4 Front Elevation: 7900). */
  liftHeightMm: 7900,
  /** Reference floor-to-roof height: 8321 + 1569 (derived R2). */
  buildingHeightMm: 9890,

  /** Top of runway rail to top of bridge girder (p.4 Front Elevation: 1369). */
  craneHeightAboveRailMm: 1369,
  /** Top of bridge girder to underside of roof (p.4 Front Elevation: 200). */
  roofClearanceMm: 200,
  /**
   * Required headroom above top of rail: 1369 + 200 = 1569 mm (derived R1,
   * matches p.4 Front Elevation: 1569 exactly).
   */
  headroomAboveRailMm: 1569,

  /**
   * Girder underside to highest hook position (p.4 Front Elevation: 620).
   * Datum interpretation: extension line begins at the underside of the girder.
   */
  hookBelowGirderMm: 620,
  /**
   * Girder underside elevation above top of rail: 7900 + 620 - 8321 = 199 mm
   * (derived R4; depends on the 620 mm datum interpretation).
   */
  girderUndersideAboveRailMm: 199,
  /**
   * Girder depth implied by 1369 - 199 = 1170 mm (derived from R4; depends on
   * the 620 mm datum interpretation).
   */
  girderDepthMm: 1170,
  /**
   * Maximum achievable lifting height loss below top of rail: 620 - 199 = 421 mm
   * (derived R5; reproduces 8321 - 421 = 7900 mm exactly).
   */
  liftLossMm: 421,

  /** Left rail centreline to closest hook centreline (p.4 Front Elevation: Min.920). */
  hookApproachLeftMm: 920,
  /**
   * Right rail centreline to closest hook centreline (p.4 Front Elevation: Min.1150).
   * Asymmetric because the hoist motor/body overhangs one side.
   */
  hookApproachRightMm: 1150,

  /**
   * End-carriage overhang past each rail centreline: (25270 - 25000) / 2 = 135 mm
   * (derived R6 from p.4 Plan View: 25270 overall bridge length).
   */
  endCarriageOverhangMm: 135,
  /** Minimum rail centreline to building wall face (p.4 Front Elevation: Min.235). */
  minWallClearanceMm: 235,

  /** End-carriage wheel centre to wheel centre (p.4 Plan View: 3800). */
  wheelbaseMm: 3800,
  /** Overall end-carriage length including buffers (p.4 Plan View: 4310). */
  endCarriageLengthMm: 4310,
  /** Runway wheel diameter (p.4 Detail Z: Ø250). */
  wheelDiameterMm: 250,
  /** Runway rail bar cross-section width x height (p.4 Detail Z: RAIL 50x30). */
  railSectionWidthMm: 50,
  railSectionHeightMm: 30,
  /** Pendant push-button clearance above floor (p.4 Front Elevation: 1000). */
  pendantBottomAboveFloorMm: 1000,
} as const;

/** Default form input — equals the reference drawing (golden test case). */
export const DEFAULT_DESIGN_INPUT: DesignInput = {
  name: '10t-25m-7.9m',
  capacityT: REFERENCE.capacityT,
  spanMm: REFERENCE.spanMm,
  railHeightMm: REFERENCE.railHeightMm,
  liftHeightMm: REFERENCE.liftHeightMm,
  buildingHeightMm: REFERENCE.buildingHeightMm,
  wallClearanceMm: REFERENCE.minWallClearanceMm,
};

export type ProvenanceKind = 'user_input' | 'reference_drawing' | 'derived' | 'estimate';

export interface DimensionRecord {
  key: string;
  label: string;
  value: number;
  unit: 'mm' | 't';
  provenance: ProvenanceKind;
  source: string;
  formula?: string;
}

export interface DomainWarning {
  field: string;
  code: string;
  message: string;
}

export interface DerivedDimensions {
  craneHeightAboveRailMm: number;
  roofClearanceMm: number;
  headroomAboveRailMm: number;
  craneTopElevationMm: number;
  requiredBuildingHeightMm: number;
  effectiveBuildingHeightMm: number;
  actualRoofClearanceMm: number;
  roofHeadroomMarginMm: number | null;
  girderUndersideElevationMm: number;
  girderDepthMm: number;
  hookBelowGirderMm: number;
  maxLiftHeightMm: number;
  liftMarginMm: number;
  hookApproachLeftMm: number;
  hookApproachRightMm: number;
  hookCoverageMm: number;
  endCarriageOverhangMm: number;
  overallBridgeLengthMm: number;
  minWallClearanceMm: number;
  effectiveWallClearanceMm: number;
  endToWallGapMm: number;
  buildingInteriorWidthMm: number;
  wheelbaseMm: number;
  endCarriageLengthMm: number;
  pendantBottomAboveFloorMm: number;
}

export interface DesignEvaluation {
  craneType: string;
  rulesVersion: string;
  isExtrapolated: boolean;
  derived: DerivedDimensions;
  dimensions: DimensionRecord[];
  warnings: DomainWarning[];
  disclaimer: string;
}

export const PRELIMINARY_DISCLAIMER =
  'PRELIMINARY OFFER DRAWING — NOT FOR CONSTRUCTION. Crane geometry is fixed from a single 10 t / 25 m reference drawing; extrapolated dimensions are estimates.';

/**
 * Layer 2 (Domain) validation: checks cross-field physical fit rules.
 * Returns blocking validation issues using the same shape as schema errors.
 */
export function validateDomainRules(input: DesignInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Guard hook coverage > 0 even if called directly without Zod bounds.
  const minSpanForApproaches = REFERENCE.hookApproachLeftMm + REFERENCE.hookApproachRightMm;
  if (input.spanMm <= minSpanForApproaches) {
    issues.push({
      field: 'spanMm',
      code: 'SPAN_TOO_SMALL_FOR_APPROACHES',
      message: `Span (${input.spanMm} mm) must be greater than the combined left + right hook approaches (${minSpanForApproaches} mm).`,
    });
  }

  // Rule R5: liftHeightMm <= railHeightMm - 421
  const maxLiftHeightMm = input.railHeightMm - REFERENCE.liftLossMm;
  if (input.liftHeightMm > maxLiftHeightMm) {
    issues.push({
      field: 'liftHeightMm',
      code: 'LIFT_EXCEEDS_MAX',
      message: `Lifting height (${input.liftHeightMm} mm) exceeds the maximum achievable lift of ${maxLiftHeightMm} mm for a ${input.railHeightMm} mm rail height (rail height − ${REFERENCE.liftLossMm} mm lift loss, derived from reference drawing R5).`,
    });
  }

  // Rule R2: buildingHeightMm >= railHeightMm + 1569 (when provided)
  if (input.buildingHeightMm !== null) {
    const requiredBuildingHeightMm = input.railHeightMm + REFERENCE.headroomAboveRailMm;
    if (input.buildingHeightMm < requiredBuildingHeightMm) {
      issues.push({
        field: 'buildingHeightMm',
        code: 'BUILDING_HEIGHT_INSUFFICIENT',
        message: `Building clear height (${input.buildingHeightMm} mm) is less than the minimum ${requiredBuildingHeightMm} mm required (rail height ${input.railHeightMm} mm + ${REFERENCE.craneHeightAboveRailMm} mm crane height + ${REFERENCE.roofClearanceMm} mm roof clearance, rules R1/R2).`,
      });
    }
  }

  // Side clearance rule: wallClearanceMm >= 235 (when provided)
  if (input.wallClearanceMm !== null && input.wallClearanceMm < REFERENCE.minWallClearanceMm) {
    issues.push({
      field: 'wallClearanceMm',
      code: 'WALL_CLEARANCE_INSUFFICIENT',
      message: `Wall clearance (${input.wallClearanceMm} mm) is below the minimum ${REFERENCE.minWallClearanceMm} mm required from rail centreline to wall face (reference drawing Min.235; gives ~100 mm crane-to-wall gap).`,
    });
  }

  return issues;
}

/**
 * Generates non-blocking warnings when inputs move outside the single
 * 10 t / 25 m reference drawing envelope.
 */
export function collectDomainWarnings(input: DesignInput): DomainWarning[] {
  const warnings: DomainWarning[] = [];

  if (input.capacityT !== REFERENCE.capacityT) {
    warnings.push({
      field: 'capacityT',
      code: 'CAPACITY_EXTRAPOLATED',
      message: `Capacity is ${input.capacityT} t, but crane height (${REFERENCE.craneHeightAboveRailMm} mm), hook headroom (${REFERENCE.hookBelowGirderMm} mm), and hook approaches (${REFERENCE.hookApproachLeftMm} / ${REFERENCE.hookApproachRightMm} mm) are fixed from the ${REFERENCE.capacityT} t reference drawing. Real hoist dimensions will differ (estimate only).`,
    });
  }

  if (input.spanMm > REFERENCE.spanMm) {
    warnings.push({
      field: 'spanMm',
      code: 'SPAN_ABOVE_REFERENCE',
      message: `Span (${input.spanMm} mm) exceeds the ${REFERENCE.spanMm} mm reference crane. A longer bridge girder is typically deeper, so crane height (${REFERENCE.craneHeightAboveRailMm} mm) and required headroom (${REFERENCE.headroomAboveRailMm} mm) may be underestimated (non-conservative).`,
    });
  }

  return warnings;
}

/**
 * Pure calculation function: takes a valid DesignInput and returns all derived
 * dimensions, per-dimension provenance records, and warnings.
 */
export function evaluateDesign(input: DesignInput): DesignEvaluation {
  const capacityDiffers = input.capacityT !== REFERENCE.capacityT;
  const spanDiffers = input.spanMm !== REFERENCE.spanMm;
  const isExtrapolated = capacityDiffers || spanDiffers;

  const refOrEst: ProvenanceKind = isExtrapolated ? 'estimate' : 'reference_drawing';
  const derivedOrEst: ProvenanceKind = isExtrapolated ? 'estimate' : 'derived';
  const extNote = isExtrapolated
    ? ' (extrapolated estimate from 10 t / 25 m reference drawing)'
    : '';

  const craneHeightAboveRailMm = REFERENCE.craneHeightAboveRailMm;
  const roofClearanceMm = REFERENCE.roofClearanceMm;
  const headroomAboveRailMm = craneHeightAboveRailMm + roofClearanceMm;
  const craneTopElevationMm = input.railHeightMm + craneHeightAboveRailMm;
  const requiredBuildingHeightMm = input.railHeightMm + headroomAboveRailMm;
  const effectiveBuildingHeightMm = input.buildingHeightMm ?? requiredBuildingHeightMm;
  const actualRoofClearanceMm = effectiveBuildingHeightMm - craneTopElevationMm;
  const roofHeadroomMarginMm =
    input.buildingHeightMm !== null ? input.buildingHeightMm - requiredBuildingHeightMm : null;

  const girderUndersideElevationMm = input.railHeightMm + REFERENCE.girderUndersideAboveRailMm;
  const girderDepthMm = REFERENCE.girderDepthMm;
  const hookBelowGirderMm = REFERENCE.hookBelowGirderMm;
  const maxLiftHeightMm = input.railHeightMm - REFERENCE.liftLossMm;
  const liftMarginMm = maxLiftHeightMm - input.liftHeightMm;

  const hookApproachLeftMm = REFERENCE.hookApproachLeftMm;
  const hookApproachRightMm = REFERENCE.hookApproachRightMm;
  const hookCoverageMm = input.spanMm - hookApproachLeftMm - hookApproachRightMm;

  const endCarriageOverhangMm = REFERENCE.endCarriageOverhangMm;
  const overallBridgeLengthMm = input.spanMm + 2 * endCarriageOverhangMm;

  const minWallClearanceMm = REFERENCE.minWallClearanceMm;
  const effectiveWallClearanceMm = input.wallClearanceMm ?? minWallClearanceMm;
  const endToWallGapMm = effectiveWallClearanceMm - endCarriageOverhangMm;
  const buildingInteriorWidthMm = input.spanMm + 2 * effectiveWallClearanceMm;

  const derived: DerivedDimensions = {
    craneHeightAboveRailMm,
    roofClearanceMm,
    headroomAboveRailMm,
    craneTopElevationMm,
    requiredBuildingHeightMm,
    effectiveBuildingHeightMm,
    actualRoofClearanceMm,
    roofHeadroomMarginMm,
    girderUndersideElevationMm,
    girderDepthMm,
    hookBelowGirderMm,
    maxLiftHeightMm,
    liftMarginMm,
    hookApproachLeftMm,
    hookApproachRightMm,
    hookCoverageMm,
    endCarriageOverhangMm,
    overallBridgeLengthMm,
    minWallClearanceMm,
    effectiveWallClearanceMm,
    endToWallGapMm,
    buildingInteriorWidthMm,
    wheelbaseMm: REFERENCE.wheelbaseMm,
    endCarriageLengthMm: REFERENCE.endCarriageLengthMm,
    pendantBottomAboveFloorMm: REFERENCE.pendantBottomAboveFloorMm,
  };

  const dimensions: DimensionRecord[] = [
    {
      key: 'capacityT',
      label: 'Rated Capacity',
      value: input.capacityT,
      unit: 't',
      provenance: 'user_input',
      source: 'User input',
    },
    {
      key: 'spanMm',
      label: 'Span (rail centre to rail centre)',
      value: input.spanMm,
      unit: 'mm',
      provenance: 'user_input',
      source: 'User input',
    },
    {
      key: 'railHeightMm',
      label: 'Runway Rail Height (floor to rail top)',
      value: input.railHeightMm,
      unit: 'mm',
      provenance: 'user_input',
      source: 'User input',
    },
    {
      key: 'liftHeightMm',
      label: 'Requested Lifting Height',
      value: input.liftHeightMm,
      unit: 'mm',
      provenance: 'user_input',
      source: 'User input',
    },
    {
      key: 'craneHeightAboveRailMm',
      label: 'Crane Height Above Rail',
      value: craneHeightAboveRailMm,
      unit: 'mm',
      provenance: refOrEst,
      source: `Reference drawing p.4 (1369 mm)${extNote}`,
    },
    {
      key: 'roofClearanceMm',
      label: 'Minimum Roof Clearance',
      value: roofClearanceMm,
      unit: 'mm',
      provenance: 'reference_drawing',
      source: 'Reference drawing p.4 (200 mm above crane top)',
    },
    {
      key: 'headroomAboveRailMm',
      label: 'Required Headroom Above Rail',
      value: headroomAboveRailMm,
      unit: 'mm',
      provenance: derivedOrEst,
      source: `Rule R1: matches reference drawing (1569 mm)${extNote}`,
      formula: 'craneHeightAboveRail + roofClearance (1369 + 200)',
    },
    {
      key: 'craneTopElevationMm',
      label: 'Crane Top Elevation Above Floor',
      value: craneTopElevationMm,
      unit: 'mm',
      provenance: derivedOrEst,
      source: `Rule R3${extNote}`,
      formula: 'railHeight + craneHeightAboveRail',
    },
    {
      key: 'requiredBuildingHeightMm',
      label: 'Minimum Building Clear Height',
      value: requiredBuildingHeightMm,
      unit: 'mm',
      provenance: derivedOrEst,
      source: `Rule R2${extNote}`,
      formula: 'railHeight + headroomAboveRail',
    },
    {
      key: 'effectiveBuildingHeightMm',
      label:
        input.buildingHeightMm !== null
          ? 'Building Clear Height (provided)'
          : 'Building Clear Height (minimum required)',
      value: effectiveBuildingHeightMm,
      unit: 'mm',
      provenance: input.buildingHeightMm !== null ? 'user_input' : derivedOrEst,
      source:
        input.buildingHeightMm !== null
          ? 'User input'
          : `Defaulted to minimum required height (Rule R2)${extNote}`,
    },
    {
      key: 'hookBelowGirderMm',
      label: 'Hook Below Girder Underside (highest position)',
      value: hookBelowGirderMm,
      unit: 'mm',
      provenance: isExtrapolated ? 'estimate' : 'reference_drawing',
      source: `Reference drawing p.4 (620 mm; datum interpreted as girder underside)${extNote}`,
    },
    {
      key: 'maxLiftHeightMm',
      label: 'Maximum Achievable Lifting Height',
      value: maxLiftHeightMm,
      unit: 'mm',
      provenance: 'estimate',
      source: `Rule R5: depends on interpreted 620 mm datum & 199 mm girder underside offset${extNote}`,
      formula: 'railHeight - 421',
    },
    {
      key: 'hookApproachLeftMm',
      label: 'Min. Hook Approach (Left)',
      value: hookApproachLeftMm,
      unit: 'mm',
      provenance: refOrEst,
      source: `Reference drawing p.4 (Min.920)${extNote}`,
    },
    {
      key: 'hookApproachRightMm',
      label: 'Min. Hook Approach (Right)',
      value: hookApproachRightMm,
      unit: 'mm',
      provenance: refOrEst,
      source: `Reference drawing p.4 (Min.1150, asymmetric hoist)${extNote}`,
    },
    {
      key: 'hookCoverageMm',
      label: 'Effective Hook Coverage Across Span',
      value: hookCoverageMm,
      unit: 'mm',
      provenance: derivedOrEst,
      source: `Rule R8${extNote}`,
      formula: 'span - hookApproachLeft - hookApproachRight',
    },
    {
      key: 'overallBridgeLengthMm',
      label: 'Overall Bridge Length',
      value: overallBridgeLengthMm,
      unit: 'mm',
      provenance: derivedOrEst,
      source: `Rule R6: matches reference drawing (25270 mm)${extNote}`,
      formula: 'span + 2 × 135 (end-carriage overhang)',
    },
    {
      key: 'effectiveWallClearanceMm',
      label:
        input.wallClearanceMm !== null
          ? 'Side Wall Clearance (provided, per side)'
          : 'Minimum Side Wall Clearance (per side)',
      value: effectiveWallClearanceMm,
      unit: 'mm',
      provenance: input.wallClearanceMm !== null ? 'user_input' : refOrEst,
      source:
        input.wallClearanceMm !== null
          ? 'User input (assumed symmetric both sides)'
          : `Reference drawing p.4 (Min.235)${extNote}`,
    },
    {
      key: 'endToWallGapMm',
      label: 'Crane End to Wall Gap (per side)',
      value: endToWallGapMm,
      unit: 'mm',
      provenance: derivedOrEst,
      source: `Rule R7${extNote}`,
      formula: 'wallClearance - 135',
    },
    {
      key: 'wheelbaseMm',
      label: 'End-Carriage Wheelbase',
      value: REFERENCE.wheelbaseMm,
      unit: 'mm',
      provenance: refOrEst,
      source: `Reference drawing p.4 Plan View (3800 mm)${extNote}`,
    },
    {
      key: 'endCarriageLengthMm',
      label: 'Overall End-Carriage Length (incl. buffers)',
      value: REFERENCE.endCarriageLengthMm,
      unit: 'mm',
      provenance: refOrEst,
      source: `Reference drawing p.4 Plan View (4310 mm = 3800 + 510)${extNote}`,
    },
  ];

  return {
    craneType: CRANE_TYPE,
    rulesVersion: RULES_VERSION,
    isExtrapolated,
    derived,
    dimensions,
    warnings: collectDomainWarnings(input),
    disclaimer: PRELIMINARY_DISCLAIMER,
  };
}

export type FullValidationResult =
  | { ok: true; input: DesignInput; evaluation: DesignEvaluation }
  | { ok: false; issues: ValidationIssue[] };

/**
 * Runs both validation layers in sequence:
 * 1. Schema validation (Zod): types, required fields, sanity bounds.
 * 2. Domain validation (rules.ts): cross-field physical fit rules.
 */
export function validateAndEvaluateDesign(payload: unknown): FullValidationResult {
  const parsed = parseDesignInput(payload);
  if (!parsed.ok) {
    return parsed;
  }

  const domainIssues = validateDomainRules(parsed.data);
  if (domainIssues.length > 0) {
    return { ok: false, issues: domainIssues };
  }

  return {
    ok: true,
    input: parsed.data,
    evaluation: evaluateDesign(parsed.data),
  };
}

export { ALLOWED_CAPACITIES_T };
