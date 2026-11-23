import { describe, expect, it } from 'vitest';
import { escapeXml, renderCraneSvg } from '../src/drawing.js';
import { DEFAULT_DESIGN_INPUT, evaluateDesign } from '../src/rules.js';

describe('SVG crane drawing generator', () => {
  it('renders a valid SVG containing all labelled reference dimensions', () => {
    const evaluation = evaluateDesign(DEFAULT_DESIGN_INPUT);
    const svg = renderCraneSvg(DEFAULT_DESIGN_INPUT, evaluation);

    expect(svg).toContain('<svg ');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('PRELIMINARY — OFFER ONLY');

    // Key labelled dimensions from page 4 reference drawing
    for (const label of [
      '25,000', // span
      '8,321', // rail height
      '1,369', // crane height above rail
      '1,569', // headroom above rail
      '200', // roof clearance
      '9,890', // building clear height
      '620', // hook below girder
      'Lift 7,900', // lifting height
      'Min.920', // left hook approach
      'Min.1,150', // right hook approach
      'Overall bridge 25,270', // bridge length
      '10t', // capacity marking on girder
    ]) {
      expect(svg).toContain(label);
    }

    // No warnings box on exact reference crane
    expect(svg).not.toContain('ENGINEERING WARNINGS');
  });

  it('marks extrapolated dimensions with ~ and renders warnings box when outside reference', () => {
    const input = { ...DEFAULT_DESIGN_INPUT, capacityT: 5 as const, spanMm: 28000 };
    const svg = renderCraneSvg(input, evaluateDesign(input));

    expect(svg).toContain('~1,369');
    expect(svg).toContain('Overall bridge ~28,270');
    expect(svg).toContain('ENGINEERING WARNINGS');
    expect(svg).toContain('5t');
  });

  it('shows both requested lift and max achievable lift when liftMarginMm > 0', () => {
    const input = {
      ...DEFAULT_DESIGN_INPUT,
      railHeightMm: 10000,
      liftHeightMm: 7000,
      buildingHeightMm: null,
      wallClearanceMm: null,
    };
    const svg = renderCraneSvg(input, evaluateDesign(input));

    expect(svg).toContain('Req. lift 7,000');
    expect(svg).toContain('Max ~9,579');
    expect(svg).toContain('Minimum required roof clear height');
    expect(svg).toContain('Min.235');
  });

  it('escapes XML/HTML characters in user-supplied design name', () => {
    const maliciousName = 'Bay <1> & "Main" \'A\'';
    expect(escapeXml(maliciousName)).toBe('Bay &lt;1&gt; &amp; &quot;Main&quot; &apos;A&apos;');

    const input = { ...DEFAULT_DESIGN_INPUT, name: maliciousName };
    const svg = renderCraneSvg(input, evaluateDesign(input));

    expect(svg).not.toContain('<1>');
    expect(svg).toContain('Bay &lt;1&gt; &amp; &quot;Main&quot; &apos;A&apos;');
  });
});
