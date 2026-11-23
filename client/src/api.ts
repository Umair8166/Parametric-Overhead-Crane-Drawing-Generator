import type { DesignDetail, DesignSummary, FieldMessage, PreviewResponse } from './types';

export class ApiError extends Error {
  status: number;
  code: string;
  fields: FieldMessage[];

  constructor(status: number, code: string, message: string, fields: FieldMessage[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'REQUEST_FAILED',
      err?.message ?? `Request failed (${res.status})`,
      Array.isArray(err?.fields) ? err.fields : [],
    );
  }

  return body as T;
}

export function previewDesign(payload: Record<string, unknown>): Promise<PreviewResponse> {
  return requestJson<PreviewResponse>('/api/designs/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listDesigns(): Promise<DesignSummary[]> {
  const data = await requestJson<{ designs: DesignSummary[] }>('/api/designs');
  return data.designs;
}

export function getDesign(id: number): Promise<DesignDetail> {
  return requestJson<DesignDetail>(`/api/designs/${id}`);
}

export function createDesign(payload: Record<string, unknown>): Promise<DesignDetail> {
  return requestJson<DesignDetail>('/api/designs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateDesign(id: number, payload: Record<string, unknown>): Promise<DesignDetail> {
  return requestJson<DesignDetail>(`/api/designs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteDesign(id: number): Promise<void> {
  return requestJson<void>(`/api/designs/${id}`, { method: 'DELETE' });
}

export function drawingDownloadUrl(id: number): string {
  return `/api/designs/${id}/drawing.svg`;
}
