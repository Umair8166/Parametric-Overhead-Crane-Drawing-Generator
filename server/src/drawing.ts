import { type DesignEvaluation, type DesignInput, REFERENCE } from './rules.js';

const SVG_W = 1200;
const SVG_H = 740;

// Viewport reserved for the scaled front elevation, leaving generous margins
// for left/right dimension tiers before the technical panel divider at x=904.
const VIEW = { left: 120, top: 120, width: 640, height: 470 };

type Tone = 'input' | 'ref' | 'estimate';

const TONE_COLOR: Record<Tone, string> = {
  input: '#0369a1',
  ref: '#1e293b',
  estimate: '#b45309',
};

/** Escapes user-supplied text before embedding into SVG/XML. */
export function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
const r = (n: number): string => n.toFixed(1);

/**
 * Horizontal dimension line between (x1, refY) and (x2, refY), offset to dimY.
 * Places the label beside the arrows when the gap is too narrow to fit text.
 */
function hDim(
  x1: number,
  x2: number,
  refY: number,
  dimY: number,
  label: string,
  opts: { tone?: Tone; labelSide?: 'center' | 'left' | 'right' } = {},
): string {
  const tone = opts.tone ?? 'ref';
  const color = TONE_COLOR[tone];
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const spanPx = maxX - minX;
  const dir = dimY < refY ? -1 : 1;
  const extEnd = dimY + dir * 6;
  const textY = dimY - 5;

  let textX = (minX + maxX) / 2;
  let anchor: 'middle' | 'end' | 'start' = 'middle';
  const side = opts.labelSide ?? (spanPx < 54 ? 'right' : 'center');
  if (side === 'left') {
    textX = minX - 6;
    anchor = 'end';
  } else if (side === 'right') {
    textX = maxX + 6;
    anchor = 'start';
  }

  return [
    `<g class="dim" stroke="${color}" fill="${color}">`,
    `  <line x1="${r(x1)}" y1="${r(refY)}" x2="${r(x1)}" y2="${r(extEnd)}" stroke-width="0.7" opacity="0.65" />`,
    `  <line x1="${r(x2)}" y1="${r(refY)}" x2="${r(x2)}" y2="${r(extEnd)}" stroke-width="0.7" opacity="0.65" />`,
    `  <line x1="${r(minX)}" y1="${r(dimY)}" x2="${r(maxX)}" y2="${r(dimY)}" stroke-width="1" marker-start="url(#as-${tone})" marker-end="url(#ae-${tone})" />`,
    `  <text x="${r(textX)}" y="${r(textY)}" text-anchor="${anchor}" stroke="none" font-size="11" font-weight="600">${escapeXml(label)}</text>`,
    `</g>`,
  ].join('\n');
}

/**
 * Vertical dimension line between (refX, y1) and (refX, y2), offset to dimX.
 * Uses rotated text along the line, or a compact horizontal callout for very small gaps.
 */
function vDim(
  refX: number,
  y1: number,
  y2: number,
  dimX: number,
  label: string,
  opts: { tone?: Tone; compactCallout?: boolean } = {},
): string {
  const tone = opts.tone ?? 'ref';
  const color = TONE_COLOR[tone];
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const spanPx = maxY - minY;
  const dir = dimX < refX ? -1 : 1;
  const extEnd = dimX + dir * 6;
  const midY = (minY + maxY) / 2;

  const textEl =
    spanPx < 22 || opts.compactCallout
      ? `<text x="${r(dimX + (dir < 0 ? -8 : 8))}" y="${r(midY + 4)}" text-anchor="${dir < 0 ? 'end' : 'start'}" stroke="none" font-size="11" font-weight="600">${escapeXml(label)}</text>`
      : `<text x="${r(dimX - 5)}" y="${r(midY)}" text-anchor="middle" stroke="none" font-size="11" font-weight="600" transform="rotate(-90 ${r(dimX - 5)} ${r(midY)})">${escapeXml(label)}</text>`;

  return [
    `<g class="dim" stroke="${color}" fill="${color}">`,
    `  <line x1="${r(refX)}" y1="${r(y1)}" x2="${r(extEnd)}" y2="${r(y1)}" stroke-width="0.7" opacity="0.65" />`,
    `  <line x1="${r(refX)}" y1="${r(y2)}" x2="${r(extEnd)}" y2="${r(y2)}" stroke-width="0.7" opacity="0.65" />`,
    `  <line x1="${r(dimX)}" y1="${r(minY)}" x2="${r(dimX)}" y2="${r(maxY)}" stroke-width="1" marker-start="url(#as-${tone})" marker-end="url(#ae-${tone})" />`,
    `  ${textEl}`,
    `</g>`,
  ].join('\n');
}

/** Wraps long warning text onto multiple SVG lines so it stays inside the info panel. */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Pure server-side SVG generator: produces a proportional 2D front elevation
 * of the crane inside its building envelope, with labelled dimensions, a
 * technical summary block, provenance legend, and preliminary stamp.
 */
export function renderCraneSvg(input: DesignInput, evaluation: DesignEvaluation): string {
  const d = evaluation.derived;
  const est = evaluation.isExtrapolated;
  const tagEst = (val: string) => (est ? `~${val}` : val);
  const estTone: Tone = est ? 'estimate' : 'ref';
  const estColor = TONE_COLOR[estTone];

  // World extents (mm): X=0 at left rail CL, Y=0 at Floor ±0 (upwards).
  const worldMinX = -d.effectiveWallClearanceMm;
  const worldMaxX = input.spanMm + d.effectiveWallClearanceMm;
  const worldW = worldMaxX - worldMinX;
  const worldH = d.effectiveBuildingHeightMm;

  // Uniform scale (px/mm) keeps both axes strictly proportional.
  const scale = Math.min(VIEW.width / worldW, VIEW.height / worldH);
  const drawnW = worldW * scale;
  const drawnH = worldH * scale;
  const padX = VIEW.left + (VIEW.width - drawnW) / 2;
  const floorY = VIEW.top + (VIEW.height + drawnH) / 2;

  const toX = (wx: number) => padX + (wx - worldMinX) * scale;
  const toY = (wy: number) => floorY - wy * scale;

  // Key pixel coordinates
  const leftWallX = toX(-d.effectiveWallClearanceMm);
  const rightWallX = toX(input.spanMm + d.effectiveWallClearanceMm);
  const leftRailX = toX(0);
  const rightRailX = toX(input.spanMm);
  const craneLeftX = toX(-REFERENCE.endCarriageOverhangMm);
  const craneRightX = toX(input.spanMm + REFERENCE.endCarriageOverhangMm);

  const roofY = toY(d.effectiveBuildingHeightMm);
  const craneTopY = toY(d.craneTopElevationMm);
  const girderBotY = toY(d.girderUndersideElevationMm);
  const railTopY = toY(input.railHeightMm);
  const maxHookY = toY(d.maxLiftHeightMm);
  const lowestHookY = toY(d.liftMarginMm);

  // Hoist centered slightly right of mid-span so lift dimensions stay clear.
  const hoistX = toX(input.spanMm * 0.56);
  const hoistW = Math.max(24, Math.min(52, 1500 * scale));
  const hoistH = Math.max(12, (maxHookY - girderBotY) * 0.62);

  // Hook approach markers (left & right closest reachable hook centres)
  const leftHookX = toX(REFERENCE.hookApproachLeftMm);
  const rightHookX = toX(input.spanMm - REFERENCE.hookApproachRightMm);
  const approachesTight = rightHookX - leftHookX < 150;

  const wallThick = 14;
  const roofThick = 12;
  const scaleRatio = Math.max(1, Math.round(1 / (scale * 0.264583)));

  // Explicit arrow markers per tone (compatible across all browsers & SVG viewers).
  const markersSvg = (Object.entries(TONE_COLOR) as [Tone, string][])
    .map(
      ([tone, color]) => `
    <marker id="ae-${tone}" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="6" markerHeight="4.5" orient="auto">
      <path d="M0,0 L10,3 L0,6 z" fill="${color}" />
    </marker>
    <marker id="as-${tone}" viewBox="0 0 10 6" refX="0" refY="3" markerWidth="6" markerHeight="4.5" orient="auto">
      <path d="M10,0 L0,3 L10,6 z" fill="${color}" />
    </marker>`,
    )
    .join('');

  // Technical summary rows (right-hand panel)
  const techRows: [string, string, string?][] = [
    ['CRANE TYPE', 'Single-girder EOT'],
    ['CAPACITY', `${input.capacityT} t`, TONE_COLOR.input],
    ['SPAN (RAIL CL)', `${fmt(input.spanMm)} mm`, TONE_COLOR.input],
    ['RAIL HEIGHT', `${fmt(input.railHeightMm)} mm`, TONE_COLOR.input],
    ['REQ. LIFT HEIGHT', `${fmt(input.liftHeightMm)} mm`, TONE_COLOR.input],
    ['MAX LIFT (R5 est.)', `${fmt(d.maxLiftHeightMm)} mm`, TONE_COLOR.estimate],
    ['CRANE ABOVE RAIL', `${tagEst(fmt(REFERENCE.craneHeightAboveRailMm))} mm`, estColor],
    ['REQ. HEADROOM', `${tagEst(fmt(REFERENCE.headroomAboveRailMm))} mm`, estColor],
    ['MIN. BLDG HEIGHT', `${tagEst(fmt(d.requiredBuildingHeightMm))} mm`, estColor],
    ['BRIDGE LENGTH', `${tagEst(fmt(d.overallBridgeLengthMm))} mm`, estColor],
    ['HOOK COVERAGE', `${tagEst(fmt(d.hookCoverageMm))} mm`, estColor],
    ['END-TO-WALL GAP', `${tagEst(fmt(d.endToWallGapMm))} mm`, estColor],
  ];

  const techRowsSvg = techRows
    .map(([k, v, col], idx) => {
      const y = 114 + idx * 21;
      return [
        `<text x="920" y="${y}" font-size="10.5" fill="#475569">${escapeXml(k)}</text>`,
        `<text x="1164" y="${y}" text-anchor="end" font-size="10.5" font-weight="600" fill="${col ?? '#0f172a'}">${escapeXml(v)}</text>`,
        `<line x1="920" y1="${y + 5}" x2="1164" y2="${y + 5}" stroke="#e2e8f0" stroke-width="0.7" />`,
      ].join('\n');
    })
    .join('\n');

  // Render active extrapolation warnings right on the drawing sheet.
  let warningsSvg = '';
  if (evaluation.warnings.length > 0) {
    const wrapped: string[] = [];
    for (const w of evaluation.warnings) {
      wrapped.push(...wrapText(`! ${w.message}`, 44));
    }
    const boxY = 442;
    const shown = wrapped.slice(0, 9);
    const boxH = 26 + shown.length * 12;
    const linesSvg = shown
      .map(
        (ln, i) =>
          `<text x="928" y="${boxY + 30 + i * 12}" font-size="9" fill="#92400e">${escapeXml(ln)}</text>`,
      )
      .join('\n');
    warningsSvg = [
      `<rect x="920" y="${boxY}" width="244" height="${boxH}" rx="4" fill="#fffbeb" stroke="#f59e0b" stroke-width="1" />`,
      `<text x="928" y="${boxY + 15}" font-size="9.5" font-weight="700" fill="#92400e">ENGINEERING WARNINGS</text>`,
      linesSvg,
    ].join('\n');
  }

  // Lift height dimensions grouped neatly on the left of the hoist.
  const liftDimSvg =
    d.liftMarginMm === 0
      ? vDim(hoistX, floorY, maxHookY, hoistX - 34, `Lift ${fmt(input.liftHeightMm)}`, {
          tone: 'input',
        })
      : [
          `<line x1="${r(hoistX - 42)}" y1="${r(lowestHookY)}" x2="${r(hoistX + 18)}" y2="${r(lowestHookY)}" stroke="#0369a1" stroke-width="0.9" stroke-dasharray="4 3" />`,
          vDim(hoistX, lowestHookY, maxHookY, hoistX - 28, `Req. lift ${fmt(input.liftHeightMm)}`, {
            tone: 'input',
          }),
          vDim(hoistX, floorY, maxHookY, hoistX - 62, `Max ~${fmt(d.maxLiftHeightMm)}`, {
            tone: 'estimate',
          }),
        ].join('\n');

  const wallClearLabel =
    input.wallClearanceMm !== null
      ? fmt(input.wallClearanceMm)
      : `Min.${fmt(REFERENCE.minWallClearanceMm)}`;
  const wallClearTone: Tone = input.wallClearanceMm !== null ? 'input' : estTone;

  const buildingHeightLabel =
    input.buildingHeightMm !== null
      ? fmt(input.buildingHeightMm)
      : `Min.${tagEst(fmt(d.requiredBuildingHeightMm))}`;
  const buildingHeightTone: Tone = input.buildingHeightMm !== null ? 'input' : estTone;

  const headroomActualMm = d.effectiveBuildingHeightMm - input.railHeightMm;
  const headroomLabel =
    input.buildingHeightMm !== null ? fmt(headroomActualMm) : tagEst(fmt(headroomActualMm));
  const headroomTone: Tone = input.buildingHeightMm !== null ? 'input' : estTone;

  const roofClearLabel =
    input.buildingHeightMm !== null
      ? fmt(d.actualRoofClearanceMm)
      : fmt(REFERENCE.roofClearanceMm);
  const roofClearTone: Tone = input.buildingHeightMm !== null ? 'input' : 'ref';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_W} ${SVG_H}" width="${SVG_W}" height="${SVG_H}" role="img" aria-label="Overhead crane front elevation drawing for ${escapeXml(input.name)}">
  <defs>${markersSvg}
  </defs>

  <style>
    svg { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; }
  </style>

  <!-- Sheet background & border -->
  <rect x="0" y="0" width="${SVG_W}" height="${SVG_H}" fill="#ffffff" />
  <rect x="14" y="14" width="${SVG_W - 28}" height="${SVG_H - 28}" fill="none" stroke="#334155" stroke-width="1.5" />

  <!-- Top header bar -->
  <text x="28" y="39" font-size="14" font-weight="700" fill="#0f172a">FRONT ELEVATION — ${escapeXml(input.name)}</text>
  <text x="28" y="55" font-size="10.5" fill="#475569">Proportional 2D view (approx. 1:${scaleRatio}) · All dimensions in mm unless noted</text>
  <rect x="655" y="24" width="232" height="28" rx="3" fill="#fef3c7" stroke="#d97706" stroke-width="1" />
  <text x="771" y="42" text-anchor="middle" font-size="10.5" font-weight="700" fill="#92400e">PRELIMINARY — OFFER ONLY</text>

  <!-- Divider between drawing area and right technical panel -->
  <line x1="904" y1="14" x2="904" y2="${SVG_H - 14}" stroke="#cbd5e1" stroke-width="1" />

  <!-- Building structure: walls, corbels, roof, floor -->
  <g id="building">
    <!-- Left & right structural walls -->
    <rect x="${r(leftWallX - wallThick)}" y="${r(roofY - roofThick)}" width="${wallThick}" height="${r(floorY - roofY + roofThick)}" fill="#e2e8f0" stroke="#475569" stroke-width="1.2" />
    <rect x="${r(rightWallX)}" y="${r(roofY - roofThick)}" width="${wallThick}" height="${r(floorY - roofY + roofThick)}" fill="#e2e8f0" stroke="#475569" stroke-width="1.2" />

    <!-- Roof slab (dashed if user omitted buildingHeightMm) -->
    ${
      input.buildingHeightMm !== null
        ? `<rect x="${r(leftWallX)}" y="${r(roofY - roofThick)}" width="${r(rightWallX - leftWallX)}" height="${roofThick}" fill="#e2e8f0" stroke="#475569" stroke-width="1.2" />`
        : `<line x1="${r(leftWallX)}" y1="${r(roofY)}" x2="${r(rightWallX)}" y2="${r(roofY)}" stroke="#64748b" stroke-width="1.4" stroke-dasharray="6 4" />
           <text x="${r((leftWallX + rightWallX) / 2)}" y="${r(roofY - 5)}" text-anchor="middle" font-size="10" fill="#64748b">Minimum required roof clear height</text>`
    }

    <!-- Runway rail corbels & runway rails -->
    <polygon points="${r(leftWallX)},${r(railTopY + 10)} ${r(leftRailX + 10)},${r(railTopY + 10)} ${r(leftRailX + 10)},${r(railTopY + 20)} ${r(leftWallX)},${r(railTopY + 34)}" fill="#cbd5e1" stroke="#475569" stroke-width="1" />
    <polygon points="${r(rightWallX)},${r(railTopY + 10)} ${r(rightRailX - 10)},${r(railTopY + 10)} ${r(rightRailX - 10)},${r(railTopY + 20)} ${r(rightWallX)},${r(railTopY + 34)}" fill="#cbd5e1" stroke="#475569" stroke-width="1" />
    <rect x="${r(leftRailX - 4)}" y="${r(railTopY)}" width="8" height="10" fill="#334155" />
    <rect x="${r(rightRailX - 4)}" y="${r(railTopY)}" width="8" height="10" fill="#334155" />

    <!-- Runway rail centrelines -->
    <line x1="${r(leftRailX)}" y1="${r(roofY - 34)}" x2="${r(leftRailX)}" y2="${r(floorY - 10)}" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="6 4" />
    <line x1="${r(rightRailX)}" y1="${r(roofY - 34)}" x2="${r(rightRailX)}" y2="${r(floorY - 10)}" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="6 4" />

    <!-- Floor line -->
    <rect x="${r(leftWallX - 24)}" y="${r(floorY)}" width="${r(rightWallX - leftWallX + 48)}" height="7" fill="#e2e8f0" />
    <line x1="${r(leftWallX - 24)}" y1="${r(floorY)}" x2="${r(rightWallX + 24)}" y2="${r(floorY)}" stroke="#0f172a" stroke-width="2" />
    <text x="${r(leftRailX + 12)}" y="${r(floorY - 6)}" font-size="10.5" font-weight="600" fill="#334155">Floor ±0</text>
  </g>

  <!-- Overhead Crane: bridge girder, end carriages, wheels, hoist, hook -->
  <g id="crane">
    <!-- Main bridge girder -->
    <rect x="${r(craneLeftX)}" y="${r(craneTopY)}" width="${r(craneRightX - craneLeftX)}" height="${r(girderBotY - craneTopY)}" fill="#e0f2fe" stroke="#0369a1" stroke-width="1.6" />
    <text x="${r((leftRailX + rightRailX) / 2)}" y="${r((craneTopY + girderBotY) / 2 + 4)}" text-anchor="middle" font-size="12" font-weight="700" fill="#0c4a6e">${escapeXml(`${input.capacityT}t`)}</text>

    <!-- End carriages sitting on runway rails -->
    <rect x="${r(craneLeftX)}" y="${r(girderBotY - 2)}" width="${r(Math.max(10, (leftRailX - craneLeftX) * 2))}" height="${r(Math.max(6, railTopY - girderBotY + 2))}" fill="#bae6fd" stroke="#0369a1" stroke-width="1.2" />
    <rect x="${r(rightRailX - (craneRightX - rightRailX))}" y="${r(girderBotY - 2)}" width="${r(Math.max(10, (craneRightX - rightRailX) * 2))}" height="${r(Math.max(6, railTopY - girderBotY + 2))}" fill="#bae6fd" stroke="#0369a1" stroke-width="1.2" />
    <circle cx="${r(leftRailX)}" cy="${r(railTopY - 3)}" r="3" fill="#0f172a" />
    <circle cx="${r(rightRailX)}" cy="${r(railTopY - 3)}" r="3" fill="#0f172a" />

    <!-- Hoist trolley & hook at highest position -->
    <rect x="${r(hoistX - hoistW / 2)}" y="${r(girderBotY)}" width="${r(hoistW)}" height="${r(hoistH)}" rx="2" fill="#f1f5f9" stroke="#1e293b" stroke-width="1.3" />
    <line x1="${r(hoistX)}" y1="${r(girderBotY + hoistH)}" x2="${r(hoistX)}" y2="${r(maxHookY)}" stroke="#1e293b" stroke-width="1.4" />
    <path d="M ${r(hoistX - 4)} ${r(maxHookY)} a 4 4 0 1 0 8 0" fill="none" stroke="#1e293b" stroke-width="1.6" />
    <line x1="${r(hoistX - 24)}" y1="${r(maxHookY)}" x2="${r(hoistX + 24)}" y2="${r(maxHookY)}" stroke="#64748b" stroke-width="0.8" stroke-dasharray="3 2" />

    <!-- Left & right closest hook position markers -->
    <line x1="${r(leftHookX)}" y1="${r(floorY - 62)}" x2="${r(leftHookX)}" y2="${r(floorY - 20)}" stroke="#64748b" stroke-width="0.9" stroke-dasharray="3 2" />
    <path d="M ${r(leftHookX - 3)} ${r(floorY - 62)} a 3 3 0 1 0 6 0" fill="none" stroke="#475569" stroke-width="1.3" />
    <line x1="${r(rightHookX)}" y1="${r(floorY - 62)}" x2="${r(rightHookX)}" y2="${r(floorY - 20)}" stroke="#64748b" stroke-width="0.9" stroke-dasharray="3 2" />
    <path d="M ${r(rightHookX - 3)} ${r(floorY - 62)} a 3 3 0 1 0 6 0" fill="none" stroke="#475569" stroke-width="1.3" />
  </g>

  <!-- Labelled Dimensions -->
  <g id="dimensions">
    <!-- Top: Span + Left & Right Wall Clearance -->
    ${hDim(leftRailX, rightRailX, roofY - 12, roofY - 34, fmt(input.spanMm), { tone: 'input' })}
    ${hDim(leftWallX, leftRailX, roofY - 12, roofY - 34, wallClearLabel, { tone: wallClearTone, labelSide: 'left' })}
    ${hDim(rightRailX, rightWallX, roofY - 12, roofY - 34, wallClearLabel, { tone: wallClearTone, labelSide: 'right' })}

    <!-- Bottom: Overall Bridge Length -->
    ${hDim(craneLeftX, craneRightX, floorY + 7, floorY + 34, `Overall bridge ${tagEst(fmt(d.overallBridgeLengthMm))}`, { tone: estTone })}

    <!-- Left vertical: Rail height, Crane height above rail, Headroom above rail -->
    ${vDim(leftWallX - wallThick, floorY, railTopY, leftWallX - wallThick - 28, fmt(input.railHeightMm), { tone: 'input' })}
    ${vDim(leftWallX - wallThick, railTopY, craneTopY, leftWallX - wallThick - 28, tagEst(fmt(REFERENCE.craneHeightAboveRailMm)), { tone: estTone })}
    ${vDim(leftWallX - wallThick, railTopY, roofY, leftWallX - wallThick - 64, headroomLabel, { tone: headroomTone })}

    <!-- Right vertical: Roof clearance & Total Building Clear Height -->
    ${vDim(rightWallX + wallThick, craneTopY, roofY, rightWallX + wallThick + 22, roofClearLabel, { tone: roofClearTone, compactCallout: true })}
    ${vDim(rightWallX + wallThick, floorY, roofY, rightWallX + wallThick + 82, buildingHeightLabel, { tone: buildingHeightTone })}

    <!-- Inside hall: Hook headroom below girder & Lifting height -->
    ${vDim(hoistX, girderBotY, maxHookY, hoistX + 34, tagEst(fmt(REFERENCE.hookBelowGirderMm)), { tone: estTone, compactCallout: true })}
    ${liftDimSvg}

    <!-- Inside hall: Asymmetric Left & Right Hook Approaches -->
    ${hDim(leftRailX, leftHookX, floorY - 34, floorY - 34, `Min.${tagEst(fmt(REFERENCE.hookApproachLeftMm))}`, { tone: estTone, labelSide: 'right' })}
    ${hDim(rightHookX, rightRailX, floorY - (approachesTight ? 58 : 34), floorY - (approachesTight ? 58 : 34), `Min.${tagEst(fmt(REFERENCE.hookApproachRightMm))}`, { tone: estTone, labelSide: 'left' })}
  </g>

  <!-- Right-hand Technical Data panel -->
  <g id="technical-data">
    <text x="920" y="88" font-size="12" font-weight="700" fill="#0f172a">TECHNICAL DATA</text>
    <line x1="920" y1="95" x2="1164" y2="95" stroke="#0f172a" stroke-width="1.2" />
    ${techRowsSvg}

    <!-- Provenance legend -->
    <text x="920" y="380" font-size="10.5" font-weight="700" fill="#0f172a">DIMENSION PROVENANCE</text>
    <circle cx="926" cy="396" r="4" fill="#0369a1" />
    <text x="936" y="400" font-size="10" fill="#334155">Blue = User input</text>
    <circle cx="926" cy="413" r="4" fill="#1e293b" />
    <text x="936" y="417" font-size="10" fill="#334155">Dark = Ref. drawing (10t / 25m) or derived</text>
    <circle cx="926" cy="430" r="4" fill="#b45309" />
    <text x="936" y="434" font-size="10" fill="#334155">Amber (~) = Estimate / extrapolated</text>

    ${warningsSvg}

    <!-- Title block -->
    <rect x="920" y="592" width="244" height="122" fill="#f8fafc" stroke="#334155" stroke-width="1" />
    <text x="930" y="612" font-size="9.5" fill="#64748b">DESIGN NAME</text>
    <text x="930" y="627" font-size="12" font-weight="700" fill="#0f172a">${escapeXml(input.name)}</text>
    <line x1="920" y1="636" x2="1164" y2="636" stroke="#cbd5e1" stroke-width="0.8" />
    <text x="930" y="652" font-size="9.5" fill="#64748b">RULES VERSION</text>
    <text x="930" y="666" font-size="10.5" font-weight="600" fill="#0f172a">${escapeXml(evaluation.rulesVersion)}</text>
    <line x1="920" y1="675" x2="1164" y2="675" stroke="#cbd5e1" stroke-width="0.8" />
    <text x="930" y="692" font-size="9.5" font-weight="700" fill="#92400e">PRELIMINARY — NOT FOR CONSTRUCTION</text>
    <text x="930" y="705" font-size="8.8" fill="#64748b">Crane dims from single 10t/25m reference.</text>
  </g>
</svg>`;
}
