import type Database from 'better-sqlite3';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db.js';

describe('GET /api/health', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = openDatabase(':memory:');
  });

  afterAll(() => {
    db.close();
  });

  it('returns ok', async () => {
    const res = await request(createApp(db)).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const res = await request(createApp(db)).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
