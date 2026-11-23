import type { DesignSummary } from '../types';

interface DesignListProps {
  designs: DesignSummary[];
  activeId: number | null;
  busy: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number, name: string) => void;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DesignList({ designs, activeId, busy, onSelect, onDelete }: DesignListProps) {
  return (
    <section className="card">
      <div className="card-header">
        <h2>Saved Designs ({designs.length})</h2>
        <span className="muted small">SQLite</span>
      </div>

      {designs.length === 0 ? (
        <p className="muted small empty-state">
          No saved designs yet. Configure parameters above and click <strong>Save Design</strong>.
        </p>
      ) : (
        <ul className="design-list">
          {designs.map((d) => {
            const isActive = d.id === activeId;
            return (
              <li key={d.id} className={`design-item ${isActive ? 'active' : ''}`}>
                <button
                  type="button"
                  className="design-item-main"
                  onClick={() => onSelect(d.id)}
                  disabled={busy}
                >
                  <span className="design-item-name">
                    #{d.id} {d.name}
                  </span>
                  <span className="design-item-meta">
                    {d.capacityT}t · {(d.spanMm / 1000).toFixed(1)}m span ·{' '}
                    {(d.liftHeightMm / 1000).toFixed(2)}m lift
                  </span>
                  <span className="design-item-time">Updated {formatDate(d.updatedAt)}</span>
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  title={`Delete ${d.name}`}
                  aria-label={`Delete ${d.name}`}
                  disabled={busy}
                  onClick={() => onDelete(d.id, d.name)}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
