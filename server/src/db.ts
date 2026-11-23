import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AllowedCapacityT, DesignInput } from './rules.js';

const DEFAULT_DB_PATH = fileURLToPath(new URL('../../data/cranes.db', import.meta.url));

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS designs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    capacity_t REAL NOT NULL,
    span_mm INTEGER NOT NULL,
    rail_height_mm INTEGER NOT NULL,
    lift_height_mm INTEGER NOT NULL,
    building_height_mm INTEGER,
    wall_clearance_mm INTEGER,
    rules_version TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

interface DesignRow {
  id: number;
  name: string;
  capacity_t: number;
  span_mm: number;
  rail_height_mm: number;
  lift_height_mm: number;
  building_height_mm: number | null;
  wall_clearance_mm: number | null;
  rules_version: string;
  created_at: string;
  updated_at: string;
}

export interface SavedDesign {
  id: number;
  input: DesignInput;
  rulesVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface DesignSummary {
  id: number;
  name: string;
  capacityT: AllowedCapacityT;
  spanMm: number;
  railHeightMm: number;
  liftHeightMm: number;
  rulesVersion: string;
  updatedAt: string;
}

/**
 * Opens the SQLite database and ensures the designs table exists.
 * Pass ':memory:' in tests for fast, isolated in-memory runs.
 */
export function openDatabase(dbPath: string = DEFAULT_DB_PATH): Database.Database {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  db.exec(SCHEMA_SQL);
  return db;
}

function rowToSavedDesign(row: DesignRow): SavedDesign {
  return {
    id: row.id,
    input: {
      name: row.name,
      capacityT: row.capacity_t as AllowedCapacityT,
      spanMm: row.span_mm,
      railHeightMm: row.rail_height_mm,
      liftHeightMm: row.lift_height_mm,
      buildingHeightMm: row.building_height_mm,
      wallClearanceMm: row.wall_clearance_mm,
    },
    rulesVersion: row.rules_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listDesigns(db: Database.Database): DesignSummary[] {
  const rows = db
    .prepare(
      `SELECT id, name, capacity_t, span_mm, rail_height_mm, lift_height_mm, rules_version, updated_at
       FROM designs
       ORDER BY updated_at DESC, id DESC`,
    )
    .all() as Omit<DesignRow, 'building_height_mm' | 'wall_clearance_mm' | 'created_at'>[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    capacityT: row.capacity_t as AllowedCapacityT,
    spanMm: row.span_mm,
    railHeightMm: row.rail_height_mm,
    liftHeightMm: row.lift_height_mm,
    rulesVersion: row.rules_version,
    updatedAt: row.updated_at,
  }));
}

export function getDesignById(db: Database.Database, id: number): SavedDesign | null {
  const row = db.prepare('SELECT * FROM designs WHERE id = ?').get(id) as DesignRow | undefined;
  return row ? rowToSavedDesign(row) : null;
}

export function createDesign(
  db: Database.Database,
  input: DesignInput,
  rulesVersion: string,
): SavedDesign {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO designs (
        name, capacity_t, span_mm, rail_height_mm, lift_height_mm,
        building_height_mm, wall_clearance_mm, rules_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.capacityT,
      input.spanMm,
      input.railHeightMm,
      input.liftHeightMm,
      input.buildingHeightMm,
      input.wallClearanceMm,
      rulesVersion,
      now,
      now,
    );

  return getDesignById(db, Number(result.lastInsertRowid))!;
}

export function updateDesign(
  db: Database.Database,
  id: number,
  input: DesignInput,
  rulesVersion: string,
): SavedDesign | null {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE designs
       SET name = ?, capacity_t = ?, span_mm = ?, rail_height_mm = ?, lift_height_mm = ?,
           building_height_mm = ?, wall_clearance_mm = ?, rules_version = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      input.name,
      input.capacityT,
      input.spanMm,
      input.railHeightMm,
      input.liftHeightMm,
      input.buildingHeightMm,
      input.wallClearanceMm,
      rulesVersion,
      now,
      id,
    );

  if (result.changes === 0) return null;
  return getDesignById(db, id);
}

export function deleteDesign(db: Database.Database, id: number): boolean {
  const result = db.prepare('DELETE FROM designs WHERE id = ?').run(id);
  return result.changes > 0;
}
