import type { FormEvent } from 'react';
import { ALLOWED_CAPACITIES_T, type FieldMessage, type FormValues } from '../types';

interface DesignFormProps {
  values: FormValues;
  editingId: number | null;
  isDirty: boolean;
  busy: boolean;
  fieldErrors: FieldMessage[];
  onChange: (field: keyof FormValues, value: string) => void;
  onPreview: () => void;
  onSave: () => void;
  onNewDesign: () => void;
  onLoadReference: () => void;
}

export function DesignForm({
  values,
  editingId,
  isDirty,
  busy,
  fieldErrors,
  onChange,
  onPreview,
  onSave,
  onNewDesign,
  onLoadReference,
}: DesignFormProps) {
  const errorFor = (field: string) =>
    fieldErrors.filter((e) => e.field === field).map((e) => e.message);

  const generalErrors = fieldErrors.filter(
    (e) =>
      ![
        'name',
        'capacityT',
        'spanMm',
        'railHeightMm',
        'liftHeightMm',
        'buildingHeightMm',
        'wallClearanceMm',
      ].includes(e.field),
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave();
  }

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>{editingId !== null ? `Editing Design #${editingId}` : 'New Crane Design'}</h2>
          <p className="muted small">
            Single-girder, top-running EOT crane · Lengths in whole mm
          </p>
        </div>
        {isDirty && <span className="badge badge-warn">Unsaved</span>}
      </div>

      <div className="quick-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onLoadReference} disabled={busy}>
          Load Reference (10t / 25m)
        </button>
        {editingId !== null && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onNewDesign} disabled={busy}>
            + New Design
          </button>
        )}
      </div>

      {generalErrors.length > 0 && (
        <div className="alert alert-error">
          {generalErrors.map((err, i) => (
            <div key={i}>{err.message}</div>
          ))}
        </div>
      )}

      {/* noValidate lets invalid values reach the Express API so server-side 422 errors are shown */}
      <form onSubmit={handleSubmit} noValidate className="design-form">
        <div className="field">
          <label htmlFor="name">Design Name *</label>
          <input
            id="name"
            type="text"
            value={values.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="e.g. Bay-2 10t-20m"
          />
          {errorFor('name').map((msg, i) => (
            <p key={i} className="field-error">
              {msg}
            </p>
          ))}
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="capacityT">Capacity (t) *</label>
            <select
              id="capacityT"
              value={values.capacityT}
              onChange={(e) => onChange('capacityT', e.target.value)}
            >
              {ALLOWED_CAPACITIES_T.map((cap) => (
                <option key={cap} value={cap}>
                  {cap} t{cap === 10 ? ' (reference)' : ''}
                </option>
              ))}
            </select>
            {errorFor('capacityT').map((msg, i) => (
              <p key={i} className="field-error">
                {msg}
              </p>
            ))}
          </div>

          <div className="field">
            <label htmlFor="spanMm">Span (mm) *</label>
            <input
              id="spanMm"
              type="number"
              inputMode="numeric"
              value={values.spanMm}
              onChange={(e) => onChange('spanMm', e.target.value)}
            />
            <span className="hint">5,000 – 30,000 mm</span>
            {errorFor('spanMm').map((msg, i) => (
              <p key={i} className="field-error">
                {msg}
              </p>
            ))}
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="railHeightMm">Rail Height (mm) *</label>
            <input
              id="railHeightMm"
              type="number"
              inputMode="numeric"
              value={values.railHeightMm}
              onChange={(e) => onChange('railHeightMm', e.target.value)}
            />
            <span className="hint">Floor to rail top (3,000 – 15,000)</span>
            {errorFor('railHeightMm').map((msg, i) => (
              <p key={i} className="field-error">
                {msg}
              </p>
            ))}
          </div>

          <div className="field">
            <label htmlFor="liftHeightMm">Lifting Height (mm) *</label>
            <input
              id="liftHeightMm"
              type="number"
              inputMode="numeric"
              value={values.liftHeightMm}
              onChange={(e) => onChange('liftHeightMm', e.target.value)}
            />
            <span className="hint">Max ≤ rail height − 421 mm (R5)</span>
            {errorFor('liftHeightMm').map((msg, i) => (
              <p key={i} className="field-error">
                {msg}
              </p>
            ))}
          </div>
        </div>

        <fieldset className="optional-group">
          <legend>Optional Building Constraints</legend>
          <div className="field-row">
            <div className="field">
              <label htmlFor="buildingHeightMm">Building Clear Height (mm)</label>
              <input
                id="buildingHeightMm"
                type="number"
                inputMode="numeric"
                value={values.buildingHeightMm}
                onChange={(e) => onChange('buildingHeightMm', e.target.value)}
                placeholder="Auto (min. required)"
              />
              <span className="hint">Min ≥ rail + 1,569 mm (R2)</span>
              {errorFor('buildingHeightMm').map((msg, i) => (
                <p key={i} className="field-error">
                  {msg}
                </p>
              ))}
            </div>

            <div className="field">
              <label htmlFor="wallClearanceMm">Wall Clearance / side (mm)</label>
              <input
                id="wallClearanceMm"
                type="number"
                inputMode="numeric"
                value={values.wallClearanceMm}
                onChange={(e) => onChange('wallClearanceMm', e.target.value)}
                placeholder="Default 235"
              />
              <span className="hint">Min ≥ 235 mm (ref. Min.235)</span>
              {errorFor('wallClearanceMm').map((msg, i) => (
                <p key={i} className="field-error">
                  {msg}
                </p>
              ))}
            </div>
          </div>
        </fieldset>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onPreview}
            disabled={busy}
          >
            Preview Drawing
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {editingId !== null ? 'Save Changes' : 'Save Design'}
          </button>
        </div>
      </form>
    </section>
  );
}
