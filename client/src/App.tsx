import { useEffect, useState } from 'react';
import {
  ApiError,
  createDesign,
  deleteDesign,
  getDesign,
  listDesigns,
  previewDesign,
  updateDesign,
} from './api';
import { DesignForm } from './components/DesignForm';
import { DesignList } from './components/DesignList';
import { DrawingPanel } from './components/DrawingPanel';
import {
  type DesignSummary,
  type FieldMessage,
  type FormValues,
  type PreviewResponse,
  REFERENCE_FORM_VALUES,
  formValuesToPayload,
  inputToFormValues,
} from './types';

export function App() {
  const [formValues, setFormValues] = useState<FormValues>(REFERENCE_FORM_VALUES);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const [designs, setDesigns] = useState<DesignSummary[]>([]);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldMessage[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Load saved designs and render initial reference crane preview on mount.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [savedList, initialPreview] = await Promise.all([
          listDesigns(),
          previewDesign(formValuesToPayload(REFERENCE_FORM_VALUES)),
        ]);
        if (cancelled) return;
        setDesigns(savedList);
        setPreview(initialPreview);
      } catch (err) {
        if (cancelled) return;
        setBannerError(err instanceof Error ? err.message : 'Failed to connect to server');
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleApiError(err: unknown) {
    if (err instanceof ApiError && err.status === 422) {
      setFieldErrors(err.fields);
      setBannerError(null);
      setStatusMessage(null);
      return;
    }
    setFieldErrors([]);
    setBannerError(err instanceof Error ? err.message : 'Unexpected request error');
  }

  function handleChange(field: keyof FormValues, value: string) {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setStatusMessage(null);
    setFieldErrors((prev) => prev.filter((e) => e.field !== field));
  }

  async function handlePreview() {
    setBusy(true);
    setBannerError(null);
    setStatusMessage(null);
    try {
      const res = await previewDesign(formValuesToPayload(formValues));
      setPreview(res);
      setFieldErrors([]);
      setStatusMessage('Preview updated (not saved).');
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    setBusy(true);
    setBannerError(null);
    setStatusMessage(null);
    const payload = formValuesToPayload(formValues);
    try {
      const saved =
        editingId !== null ? await updateDesign(editingId, payload) : await createDesign(payload);
      setEditingId(saved.id);
      setFormValues(inputToFormValues(saved.input));
      setPreview(saved);
      setIsDirty(false);
      setFieldErrors([]);
      setDesigns(await listDesigns());
      setStatusMessage(
        editingId !== null ? `Updated design #${saved.id}.` : `Saved new design #${saved.id}.`,
      );
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenDesign(id: number) {
    setBusy(true);
    setBannerError(null);
    setStatusMessage(null);
    try {
      const detail = await getDesign(id);
      setEditingId(detail.id);
      setFormValues(inputToFormValues(detail.input));
      setPreview(detail);
      setIsDirty(false);
      setFieldErrors([]);
      setStatusMessage(`Opened design #${detail.id} (${detail.input.name}).`);
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteDesign(id: number, name: string) {
    if (!window.confirm(`Delete saved design #${id} ("${name}")?`)) return;
    setBusy(true);
    setBannerError(null);
    try {
      await deleteDesign(id);
      setDesigns(await listDesigns());
      if (editingId === id) {
        setEditingId(null);
        setIsDirty(true);
      }
      setStatusMessage(`Deleted design #${id}.`);
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  function handleNewDesign() {
    setEditingId(null);
    setFormValues(REFERENCE_FORM_VALUES);
    setIsDirty(false);
    setFieldErrors([]);
    setBannerError(null);
    setStatusMessage('Started a new design from reference defaults.');
  }

  async function handleLoadReference() {
    setFormValues(REFERENCE_FORM_VALUES);
    setIsDirty(editingId !== null);
    setFieldErrors([]);
    setBannerError(null);
    try {
      const res = await previewDesign(formValuesToPayload(REFERENCE_FORM_VALUES));
      setPreview(res);
      setStatusMessage('Loaded 10t / 25m reference drawing parameters.');
    } catch (err) {
      handleApiError(err);
    }
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <h1>Parametric Overhead Crane Drawing Generator</h1>
          <p className="muted small">
            Preliminary offer General Arrangement (GA) tool · Single-girder top-running EOT crane
          </p>
        </div>
        {statusMessage && <div className="status-pill">{statusMessage}</div>}
      </header>

      {bannerError && (
        <div className="alert alert-error" role="alert">
          {bannerError}
        </div>
      )}

      <main className="layout">
        <aside className="left-column">
          <DesignForm
            values={formValues}
            editingId={editingId}
            isDirty={isDirty}
            busy={busy}
            fieldErrors={fieldErrors}
            onChange={handleChange}
            onPreview={handlePreview}
            onSave={handleSave}
            onNewDesign={handleNewDesign}
            onLoadReference={handleLoadReference}
          />
          <DesignList
            designs={designs}
            activeId={editingId}
            busy={busy}
            onSelect={handleOpenDesign}
            onDelete={handleDeleteDesign}
          />
        </aside>

        <section className="right-column">
          <DrawingPanel preview={preview} savedId={editingId} isDirty={isDirty} />
        </section>
      </main>
    </div>
  );
}
