import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DESIGN_INPUT,
  REFERENCE,
  RULES_VERSION,
  evaluateDesign,
  validateAndEvaluateDesign,
  validateDomainRules,
} from '../src/rules.js';
import { parseDesignInput } from '../src/validation.js';

describe('crane rules — golden reference drawing test (p.4)', () => {
  it('reproduces all reference drawing dimensions exactly with no warnings', () => {
    const res = validateAndEvaluateDesign(DEFAULT_DESIGN_INPUT);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const { evaluation } = res;
    expect(evaluation.rulesVersion).toBe(RULES_VERSION);
    expect(evaluation.isExtrapolated).toBe(false);
    expect(evaluation.warnings).toEqual([]);

    expect(evaluation.derived).toMatchObject({
      craneHeightAboveRailMm: 1369,
      roofClearanceMm: 200,
      headroomAboveRailMm: 1569,
      craneTopElevationMm: 9690,
      requiredBuildingHeightMm: 9890,
      effectiveBuildingHeightMm: 9890,
      actualRoofClearanceMm: 200,
      roofHeadroomMarginMm: 0,
      girderUndersideElevationMm: 8520,
      girderDepthMm: 1170,
      hookBelowGirderMm: 620,
      maxLiftHeightMm: 7900,
      liftMarginMm: 0,
      hookApproachLeftMm: 920,
      hookApproachRightMm: 1150,
      hookCoverageMm: 22930,
      endCarriageOverhangMm: 135,
      overallBridgeLengthMm: 25270,
      minWallClearanceMm: 235,
      effectiveWallClearanceMm: 235,
      endToWallGapMm: 100,
      buildingInteriorWidthMm: 25470,
      wheelbaseMm: 3800,
      endCarriageLengthMm: 4310,
      pendantBottomAboveFloorMm: 1000,
    });

    const byKey = Object.fromEntries(evaluation.dimensions.map((d) => [d.key, d]));
    expect(byKey.spanMm.provenance).toBe('user_input');
    expect(byKey.craneHeightAboveRailMm.provenance).toBe('reference_drawing');
    expect(byKey.headroomAboveRailMm.provenance).toBe('derived');
    expect(byKey.overallBridgeLengthMm.provenance).toBe('derived');
    // Rule R5 always depends on the interpreted 620 mm datum -> explicitly flagged as estimate.
    expect(byKey.maxLiftHeightMm.provenance).toBe('estimate');
  });
});

describe('domain validation rules (cross-field fit checks)', () => {
  it('accepts lift height exactly at railHeightMm - 421 and rejects 1 mm over', () => {
    const atLimit = validateAndEvaluateDesign({
      ...DEFAULT_DESIGN_INPUT,
      railHeightMm: 9000,
      liftHeightMm: 9000 - REFERENCE.liftLossMm, // 8579
      buildingHeightMm: 9000 + REFERENCE.headroomAboveRailMm,
    });
    expect(atLimit.ok).toBe(true);
    if (atLimit.ok) {
      expect(atLimit.evaluation.derived.maxLiftHeightMm).toBe(8579);
      expect(atLimit.evaluation.derived.liftMarginMm).toBe(0);
    }

    const oneMmOver = validateAndEvaluateDesign({
      ...DEFAULT_DESIGN_INPUT,
      railHeightMm: 9000,
      liftHeightMm: 9000 - REFERENCE.liftLossMm + 1, // 8580
      buildingHeightMm: 9000 + REFERENCE.headroomAboveRailMm,
    });
    expect(oneMmOver.ok).toBe(false);
    if (!oneMmOver.ok) {
      expect(oneMmOver.issues).toHaveLength(1);
      expect(oneMmOver.issues[0].field).toBe('liftHeightMm');
      expect(oneMmOver.issues[0].code).toBe('LIFT_EXCEEDS_MAX');
    }
  });

  it('tracks spare lift margin when requested lift is below max achievable lift', () => {
    const res = validateAndEvaluateDesign({
      ...DEFAULT_DESIGN_INPUT,
      railHeightMm: 10000,
      liftHeightMm: 7000,
      buildingHeightMm: null,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.evaluation.derived.maxLiftHeightMm).toBe(9579);
    expect(res.evaluation.derived.liftMarginMm).toBe(2579);
  });

  it('accepts buildingHeightMm at railHeightMm + 1569 and rejects 1 mm under', () => {
    const exact = validateAndEvaluateDesign({
      ...DEFAULT_DESIGN_INPUT,
      buildingHeightMm: DEFAULT_DESIGN_INPUT.railHeightMm + 1569,
    });
    expect(exact.ok).toBe(true);

    const tooLow = validateAndEvaluateDesign({
      ...DEFAULT_DESIGN_INPUT,
      buildingHeightMm: DEFAULT_DESIGN_INPUT.railHeightMm + 1568,
    });
    expect(tooLow.ok).toBe(false);
    if (!tooLow.ok) {
      expect(tooLow.issues).toHaveLength(1);
      expect(tooLow.issues[0].field).toBe('buildingHeightMm');
      expect(tooLow.issues[0].code).toBe('BUILDING_HEIGHT_INSUFFICIENT');
    }
  });

  it('computes roof margin when buildingHeightMm exceeds minimum and defaults when omitted', () => {
    const taller = validateAndEvaluateDesign({
      ...DEFAULT_DESIGN_INPUT,
      buildingHeightMm: 10500,
    });
    expect(taller.ok).toBe(true);
    if (taller.ok) {
      expect(taller.evaluation.derived.actualRoofClearanceMm).toBe(810);
      expect(taller.evaluation.derived.roofHeadroomMarginMm).toBe(610);
    }

    const { buildingHeightMm: _b, wallClearanceMm: _w, ...withoutOptionals } = DEFAULT_DESIGN_INPUT;
    const omitted = validateAndEvaluateDesign(withoutOptionals);
    expect(omitted.ok).toBe(true);
    if (omitted.ok) {
      expect(omitted.input.buildingHeightMm).toBeNull();
      expect(omitted.input.wallClearanceMm).toBeNull();
      expect(omitted.evaluation.derived.effectiveBuildingHeightMm).toBe(9890);
      expect(omitted.evaluation.derived.roofHeadroomMarginMm).toBeNull();
      expect(omitted.evaluation.derived.effectiveWallClearanceMm).toBe(235);
      expect(omitted.evaluation.derived.endToWallGapMm).toBe(100);
    }
  });

  it('rejects wallClearanceMm below 235 mm', () => {
    const tooNarrow = validateAndEvaluateDesign({
      ...DEFAULT_DESIGN_INPUT,
      wallClearanceMm: 234,
    });
    expect(tooNarrow.ok).toBe(false);
    if (!tooNarrow.ok) {
      expect(tooNarrow.issues).toHaveLength(1);
      expect(tooNarrow.issues[0].field).toBe('wallClearanceMm');
      expect(tooNarrow.issues[0].code).toBe('WALL_CLEARANCE_INSUFFICIENT');
    }
  });

  it('reports all violated domain rules at once', () => {
    const res = validateAndEvaluateDesign({
      ...DEFAULT_DESIGN_INPUT,
      liftHeightMm: 8200,
      buildingHeightMm: 9500,
      wallClearanceMm: 180,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const codes = res.issues.map((i) => i.code);
      expect(codes).toEqual([
        'LIFT_EXCEEDS_MAX',
        'BUILDING_HEIGHT_INSUFFICIENT',
        'WALL_CLEARANCE_INSUFFICIENT',
      ]);
    }
  });

  it('guards span <= hook approaches when validateDomainRules is called directly', () => {
    const issues = validateDomainRules({
      ...DEFAULT_DESIGN_INPUT,
      spanMm: 2000,
    });
    expect(issues.some((i) => i.code === 'SPAN_TOO_SMALL_FOR_APPROACHES')).toBe(true);
  });
});

describe('engineering honesty — warnings and estimate provenance', () => {
  it('warns and tags dimensions as estimates when capacity differs from 10 t', () => {
    const res = validateAndEvaluateDesign({
      ...DEFAULT_DESIGN_INPUT,
      capacityT: 5,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.evaluation.isExtrapolated).toBe(true);
    expect(res.evaluation.warnings.map((w) => w.code)).toEqual(['CAPACITY_EXTRAPOLATED']);
    const craneHeight = res.evaluation.dimensions.find((d) => d.key === 'craneHeightAboveRailMm');
    expect(craneHeight?.provenance).toBe('estimate');
  });

  it('warns on spans > 25000 mm (non-conservative headroom) but not on spans < 25000 mm', () => {
    const longer = evaluateDesign({ ...DEFAULT_DESIGN_INPUT, spanMm: 28000 });
    expect(longer.isExtrapolated).toBe(true);
    expect(longer.warnings.map((w) => w.code)).toEqual(['SPAN_ABOVE_REFERENCE']);

    const shorter = evaluateDesign({ ...DEFAULT_DESIGN_INPUT, spanMm: 16000 });
    expect(shorter.isExtrapolated).toBe(true);
    expect(shorter.warnings).toEqual([]);
    const bridgeLen = shorter.dimensions.find((d) => d.key === 'overallBridgeLengthMm');
    expect(bridgeLen?.value).toBe(16270);
    expect(bridgeLen?.provenance).toBe('estimate');
  });

  it('emits both warnings when capacity != 10 t and span > 25000 mm', () => {
    const evalRes = evaluateDesign({
      ...DEFAULT_DESIGN_INPUT,
      capacityT: 16,
      spanMm: 30000,
    });
    expect(evalRes.warnings.map((w) => w.code)).toEqual([
      'CAPACITY_EXTRAPOLATED',
      'SPAN_ABOVE_REFERENCE',
    ]);
  });
});

describe('schema validation (Zod layer)', () => {
  it('trims design name and rejects blank names', () => {
    const trimmed = parseDesignInput({ ...DEFAULT_DESIGN_INPUT, name: '  Bay 3 Crane  ' });
    expect(trimmed.ok).toBe(true);
    if (trimmed.ok) expect(trimmed.data.name).toBe('Bay 3 Crane');

    const blank = parseDesignInput({ ...DEFAULT_DESIGN_INPUT, name: '   ' });
    expect(blank.ok).toBe(false);
    if (!blank.ok) expect(blank.issues[0].field).toBe('name');
  });

  it('rejects non-catalog capacity, floats, string numbers, and out-of-range bounds', () => {
    const badCapacity = parseDesignInput({ ...DEFAULT_DESIGN_INPUT, capacityT: 7 });
    expect(badCapacity.ok).toBe(false);

    const floatSpan = parseDesignInput({ ...DEFAULT_DESIGN_INPUT, spanMm: 25000.5 });
    expect(floatSpan.ok).toBe(false);

    const stringSpan = parseDesignInput({ ...DEFAULT_DESIGN_INPUT, spanMm: '25000' });
    expect(stringSpan.ok).toBe(false);

    const shortSpan = parseDesignInput({ ...DEFAULT_DESIGN_INPUT, spanMm: 4999 });
    expect(shortSpan.ok).toBe(false);

    const longSpan = parseDesignInput({ ...DEFAULT_DESIGN_INPUT, spanMm: 30001 });
    expect(longSpan.ok).toBe(false);
  });

  it('handles non-object payloads cleanly', () => {
    const res = parseDesignInput(null);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.issues[0].field).toBe('body');
    }
  });
});
