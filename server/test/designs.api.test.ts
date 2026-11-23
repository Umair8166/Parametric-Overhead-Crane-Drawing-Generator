import type Database from 'better-sqlite3';
import type { Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db.js';
import { DEFAULT_DESIGN_INPUT, RULES_VERSION } from '../src/rules.js';

describe('/api/designs', () => {
  let db: Database.Database;
  let app: Express;

  beforeEach(() => {
    db = openDatabase(':memory:');
    app = createApp(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('POST /api/designs/preview', () => {
    it('evaluates valid reference inputs without saving to DB', async () => {
      const res = await request(app).post('/api/designs/preview').send(DEFAULT_DESIGN_INPUT);

      expect(res.status).toBe(200);
      expect(res.body.input).toEqual(DEFAULT_DESIGN_INPUT);
      expect(res.body.evaluation.derived.overallBridgeLengthMm).toBe(25270);
      expect(res.body.evaluation.warnings).toEqual([]);
      expect(res.body.svg).toContain('<svg ');

      const list = await request(app).get('/api/designs');
      expect(list.body.designs).toEqual([]);
    });

    it('returns non-blocking warnings for extrapolated inputs', async () => {
      const res = await request(app)
        .post('/api/designs/preview')
        .send({ ...DEFAULT_DESIGN_INPUT, capacityT: 5, spanMm: 28000 });

      expect(res.status).toBe(200);
      expect(res.body.evaluation.isExtrapolated).toBe(true);
      expect(res.body.evaluation.warnings.map((w: { field: string }) => w.field)).toEqual([
        'capacityT',
        'spanMm',
      ]);
    });

    it('returns 422 with field-level errors on schema or domain failures', async () => {
      const badSchema = await request(app)
        .post('/api/designs/preview')
        .send({ ...DEFAULT_DESIGN_INPUT, capacityT: 7, spanMm: -100 });

      expect(badSchema.status).toBe(422);
      expect(badSchema.body.error.code).toBe('VALIDATION_ERROR');
      expect(badSchema.body.error.fields.map((f: { field: string }) => f.field)).toEqual(
        expect.arrayContaining(['capacityT', 'spanMm']),
      );

      const badDomain = await request(app)
        .post('/api/designs/preview')
        .send({ ...DEFAULT_DESIGN_INPUT, liftHeightMm: 8000, buildingHeightMm: 9500 });

      expect(badDomain.status).toBe(422);
      expect(badDomain.body.error.fields.map((f: { field: string }) => f.field)).toEqual([
        'liftHeightMm',
        'buildingHeightMm',
      ]);
    });
  });

  describe('CRUD lifecycle (create, list, reopen, edit, delete)', () => {
    it('creates, lists, reopens, edits, and deletes designs', async () => {
      // 1. Empty list initially
      const initial = await request(app).get('/api/designs');
      expect(initial.status).toBe(200);
      expect(initial.body.designs).toEqual([]);

      // 2. Create first design (with optional fields omitted)
      const created1 = await request(app).post('/api/designs').send({
        name: 'Bay 1 Crane',
        capacityT: 5,
        spanMm: 18000,
        railHeightMm: 7000,
        liftHeightMm: 6000,
      });
      expect(created1.status).toBe(201);
      expect(created1.body.id).toBe(1);
      expect(created1.body.rulesVersion).toBe(RULES_VERSION);
      expect(created1.body.input.buildingHeightMm).toBeNull();
      expect(created1.body.input.wallClearanceMm).toBeNull();
      expect(created1.body.evaluation.derived.overallBridgeLengthMm).toBe(18270);
      expect(created1.body.svg).toContain('Bay 1 Crane');

      // 3. Create second design (reference crane)
      const created2 = await request(app).post('/api/designs').send(DEFAULT_DESIGN_INPUT);
      expect(created2.status).toBe(201);
      expect(created2.body.id).toBe(2);

      // 4. List returns both designs (most recent first)
      const list = await request(app).get('/api/designs');
      expect(list.status).toBe(200);
      expect(list.body.designs.map((d: { id: number }) => d.id)).toEqual([2, 1]);

      // 5. Reopen design 1 and verify derived values + SVG recomputed from stored inputs
      const reopened = await request(app).get('/api/designs/1');
      expect(reopened.status).toBe(200);
      expect(reopened.body.input.name).toBe('Bay 1 Crane');
      expect(reopened.body.evaluation.derived.requiredBuildingHeightMm).toBe(8569);
      expect(reopened.body.svg).toContain('18,000');

      // 6. Edit design 1 with valid changes
      const edited = await request(app).put('/api/designs/1').send({
        name: 'Bay 1 Crane Rev B',
        capacityT: 10,
        spanMm: 20000,
        railHeightMm: 7500,
        liftHeightMm: 7000,
        buildingHeightMm: 9200,
        wallClearanceMm: 300,
      });
      expect(edited.status).toBe(200);
      expect(edited.body.id).toBe(1);
      expect(edited.body.createdAt).toBe(created1.body.createdAt);
      expect(edited.body.input.name).toBe('Bay 1 Crane Rev B');
      expect(edited.body.evaluation.derived.overallBridgeLengthMm).toBe(20270);
      expect(edited.body.evaluation.derived.endToWallGapMm).toBe(165);
      expect(edited.body.svg).toContain('Bay 1 Crane Rev B');

      // 7. Invalid edit fails with 422 and leaves stored record unchanged
      const badEdit = await request(app).put('/api/designs/1').send({
        ...edited.body.input,
        wallClearanceMm: 150,
      });
      expect(badEdit.status).toBe(422);

      const afterBadEdit = await request(app).get('/api/designs/1');
      expect(afterBadEdit.body.input.wallClearanceMm).toBe(300);

      // 8. Delete design 1
      const del = await request(app).delete('/api/designs/1');
      expect(del.status).toBe(204);

      const afterDelete = await request(app).get('/api/designs/1');
      expect(afterDelete.status).toBe(404);
      expect(afterDelete.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('SVG drawing download endpoint', () => {
    it('serves downloadable image/svg+xml and returns 404/400 on bad IDs', async () => {
      const created = await request(app).post('/api/designs').send(DEFAULT_DESIGN_INPUT);
      expect(created.status).toBe(201);

      const download = await request(app).get(`/api/designs/${created.body.id}/drawing.svg`);
      expect(download.status).toBe(200);
      expect(download.headers['content-type']).toContain('image/svg+xml');
      expect(download.headers['content-disposition']).toContain('10t-25m-7.9m.svg');
      const svgText = Buffer.isBuffer(download.body)
        ? download.body.toString('utf8')
        : download.text;
      expect(svgText).toContain('Overall bridge 25,270');

      const missing = await request(app).get('/api/designs/999/drawing.svg');
      expect(missing.status).toBe(404);

      const invalid = await request(app).get('/api/designs/abc/drawing.svg');
      expect(invalid.status).toBe(400);
    });
  });

  describe('error handling edge cases', () => {
    it('returns 404 for missing design IDs on GET, PUT, and DELETE', async () => {
      for (const res of [
        await request(app).get('/api/designs/999'),
        await request(app).put('/api/designs/999').send(DEFAULT_DESIGN_INPUT),
        await request(app).delete('/api/designs/999'),
      ]) {
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns 400 for non-positive-integer IDs', async () => {
      for (const badId of ['abc', '0', '-5', '1.5']) {
        const res = await request(app).get(`/api/designs/${badId}`);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_ID');
      }
    });

    it('returns 400 INVALID_JSON instead of 500 for malformed JSON bodies', async () => {
      const res = await request(app)
        .post('/api/designs')
        .set('Content-Type', 'application/json')
        .send('{"name": "broken"');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_JSON');
    });
  });
});
