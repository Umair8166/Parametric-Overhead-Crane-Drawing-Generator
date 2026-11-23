import { drawingDownloadUrl } from '../api';
import type { PreviewResponse, Provenance } from '../types';

interface DrawingPanelProps {
  preview: PreviewResponse | null;
  savedId: number | null;
  isDirty: boolean;
}

const PROVENANCE_LABEL: Record<Provenance, string> = {
  user_input: 'User input',
  reference_drawing: 'Ref. drawing',
  derived: 'Derived',
  estimate: 'Estimate',
};

export function DrawingPanel({ preview, savedId, isDirty }: DrawingPanelProps) {
  if (!preview) {
    return (
      <section className="card drawing-panel">
        <p className="muted">Enter crane parameters and click Preview Drawing.</p>
      </section>
    );
  }

  const { input, evaluation, svg } = preview;

  function handleClientDownload() {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${input.name.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'crane-drawing'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="right-stack">
      <section className="card drawing-panel">
        <div className="card-header">
          <div>
            <h2>2D Dimensioned Drawing — {input.name}</h2>
            <p className="muted small">
              {evaluation.craneType} · Rules <code>{evaluation.rulesVersion}</code>
            </p>
          </div>
          {savedId !== null && !isDirty ? (
            <a className="btn btn-secondary btn-sm" href={drawingDownloadUrl(savedId)} download>
              Download SVG
            </a>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClientDownload}
            >
              Download SVG
            </button>
          )}
        </div>

        {evaluation.warnings.length > 0 && (
          <div className="alert alert-warn" role="status">
            <strong>Engineering Estimates / Warnings</strong>
            <ul>
              {evaluation.warnings.map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="svg-frame" dangerouslySetInnerHTML={{ __html: svg }} />

        <p className="disclaimer">{evaluation.disclaimer}</p>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Dimensions &amp; Rule Provenance</h2>
          <span className="muted small">Every value sourced or flagged as estimate</span>
        </div>

        <div className="table-wrap">
          <table className="dims-table">
            <thead>
              <tr>
                <th>Dimension</th>
                <th className="num">Value</th>
                <th>Provenance</th>
                <th>Source / Formula</th>
              </tr>
            </thead>
            <tbody>
              {evaluation.dimensions.map((d) => (
                <tr key={d.key}>
                  <td>{d.label}</td>
                  <td className="num">
                    {d.value.toLocaleString('en-US')} {d.unit}
                  </td>
                  <td>
                    <span className={`pill pill-${d.provenance}`}>
                      {PROVENANCE_LABEL[d.provenance]}
                    </span>
                  </td>
                  <td className="muted small">{d.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
