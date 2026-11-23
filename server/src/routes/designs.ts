import type Database from 'better-sqlite3';
import { Router, type Response } from 'express';
import { createDesign, deleteDesign, getDesignById, listDesigns, updateDesign } from '../db.js';
import { type FieldMessage, RULES_VERSION, evaluateDesign } from '../rules.js';
import { validateAndEvaluateDesign } from '../validation.js';

function parsePositiveId(raw: string): number | null {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

function sendValidationError(res: Response, fields: FieldMessage[]): void {
  res.status(422).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Design inputs failed validation',
      fields,
    },
  });
}

function sendNotFound(res: Response, id: number): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Design ${id} not found`,
    },
  });
}

function sendInvalidId(res: Response): void {
  res.status(400).json({
    error: {
      code: 'INVALID_ID',
      message: 'Design ID must be a positive integer',
    },
  });
}

export function createDesignsRouter(db: Database.Database): Router {
  const router = Router();

  // Validate and compute a design without saving it to the database.
  router.post('/preview', (req, res) => {
    const result = validateAndEvaluateDesign(req.body);
    if (!result.ok) {
      sendValidationError(res, result.errors);
      return;
    }

    res.json({
      input: result.input,
      evaluation: result.evaluation,
    });
  });

  // List saved designs (newest updated first).
  router.get('/', (_req, res) => {
    res.json({ designs: listDesigns(db) });
  });

  // Validate and save a new design.
  router.post('/', (req, res) => {
    const result = validateAndEvaluateDesign(req.body);
    if (!result.ok) {
      sendValidationError(res, result.errors);
      return;
    }

    const saved = createDesign(db, result.input, RULES_VERSION);
    res.status(201).json({
      ...saved,
      evaluation: result.evaluation,
    });
  });

  // Reopen a saved design and recompute derived dimensions from stored inputs.
  router.get('/:id', (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (id === null) {
      sendInvalidId(res);
      return;
    }

    const saved = getDesignById(db, id);
    if (!saved) {
      sendNotFound(res, id);
      return;
    }

    res.json({
      ...saved,
      evaluation: evaluateDesign(saved.input),
    });
  });

  // Edit an existing saved design.
  router.put('/:id', (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (id === null) {
      sendInvalidId(res);
      return;
    }

    const existing = getDesignById(db, id);
    if (!existing) {
      sendNotFound(res, id);
      return;
    }

    const result = validateAndEvaluateDesign(req.body);
    if (!result.ok) {
      sendValidationError(res, result.errors);
      return;
    }

    const updated = updateDesign(db, id, result.input, RULES_VERSION)!;
    res.json({
      ...updated,
      evaluation: result.evaluation,
    });
  });

  // Delete a saved design.
  router.delete('/:id', (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (id === null) {
      sendInvalidId(res);
      return;
    }

    const deleted = deleteDesign(db, id);
    if (!deleted) {
      sendNotFound(res, id);
      return;
    }

    res.status(204).end();
  });

  return router;
}
