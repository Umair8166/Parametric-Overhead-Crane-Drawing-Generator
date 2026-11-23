# Parametric Overhead Crane Drawing Generator

A full-stack web application that generates a proportional, dimensioned 2D SVG drawing of a **single-girder, top-running EOT (Electric Overhead Travelling) crane** from user inputs, validates physical building-fit rules on the server, and persists designs in SQLite so users can list, reopen, edit, and download them.

Built as a preliminary quotation / General Arrangement (GA) tool based on the attached 10 t / 25 m reference drawing.

---

## How to Run Locally

**Prerequisites:** Node.js **20+** (built and tested on Node `24.15.0`; see `.nvmrc`).

```bash
npm install
npm start
```

Open **http://localhost:3000** in your browser.

`npm start` builds the React frontend (`client/dist`), compiles the TypeScript Express server (`server/dist`), and starts Express serving both `/api/*` and the built frontend on port `3000` (configurable via `PORT`). SQLite is created automatically at `data/cranes.db` on first run (configurable via `DB_PATH`).

### Development & Tests

```bash
# Hot-reload backend (tsx watch) + frontend (Vite with /api proxy)
npm run dev

# Run unit, rules, SVG, and API integration tests (Vitest + supertest)
npm test
```

---

## Stack & Why

| Layer | Choice | Why |
|---|---|---|
| **Runtime & Language** | Node.js 24 + TypeScript (strict) | One language end to end, strong familiarity, fast iteration, strict type safety between rules, API, and UI. |
| **Repo layout** | npm workspaces (`server/`, `client/`) | Built into npm (no extra monorepo tools); lets `npm install && npm start` run the full stack with one lockfile while keeping Node and Browser `tsconfig` / dependencies cleanly separated. |
| **HTTP API** | Express 5 | Minimal, standard, and Express 5 forwards rejected async errors cleanly to central error middleware. |
| **Server-side Validation** | Zod v4 (Layer 1) + pure `rules.ts` (Layer 2) | Zod validates JSON shape, types, integer mm, and sanity bounds. Cross-field crane fit rules live in dependency-free `rules.ts` with source comments so engineering logic is isolated and unit-testable. |
| **Database** | SQLite via `better-sqlite3` (no ORM) | Zero-setup file DB (`data/cranes.db` on disk, `:memory:` in tests). Only one table (`designs`) is needed, so prepared statements are shorter and clearer than an ORM. |
| **2D Drawing** | Pure server-side SVG generator (`server/src/drawing.ts`) | Single source of truth: the exact validated inputs and evaluated dimensions produce a proportional SVG directly with zero drawing libraries. Supports inline display and direct `.svg` download. |
| **Frontend** | React + Vite + TypeScript + plain CSS | Small, responsive UI (4 focused components, `fetch`, no router or UI framework overhead). Uses `noValidate` on the form so invalid inputs are verified by the server API. |
| **Testing** | Vitest + supertest | Fast tests covering golden reference-drawing reproduction, 1 mm rule boundaries, SVG output & XML escaping, and full HTTP CRUD + error-handling flows. |

---

## API Endpoints

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/api/health` | Health check | `200` |
| `POST` | `/api/designs/preview` | Validate inputs, compute dimensions + SVG (does not save) | `200`, `400`, `422` |
| `GET` | `/api/designs` | List saved designs (newest updated first) | `200` |
| `POST` | `/api/designs` | Validate and save a new design | `201`, `400`, `422` |
| `GET` | `/api/designs/:id` | Reopen a saved design (recomputes evaluation + SVG from stored inputs) | `200`, `400`, `404` |
| `PUT` | `/api/designs/:id` | Validate and update an existing design | `200`, `400`, `404`, `422` |
| `DELETE` | `/api/designs/:id` | Delete a saved design | `204`, `400`, `404` |
| `GET` | `/api/designs/:id/drawing.svg` | Download generated SVG drawing (`image/svg+xml`) | `200`, `400`, `404` |

### Quick Server-Side Validation Check (`curl`)

```bash
curl -i -X POST http://localhost:3000/api/designs \
  -H "Content-Type: application/json" \
  -d '{"name":"Too Tall Lift","capacityT":10,"spanMm":25000,"railHeightMm":8321,"liftHeightMm":8000,"buildingHeightMm":9500,"wallClearanceMm":180}'
```

Returns **HTTP 422** with field-level errors for `liftHeightMm` (exceeds max `7900 mm`), `buildingHeightMm` (below min `9890 mm`), and `wallClearanceMm` (below min `235 mm`).

---

## Domain Rules & Provenance (`ref-10t-25m-v1`)

All crane-side dimensions come from the single reference drawing on page 4 (`10 t`, `25,000 mm` span, `8,321 mm` rail height, `7,900 mm` lifting height). Inputs are persisted; derived dimensions are recomputed on read so stored designs stay consistent and auditable alongside their `rules_version`.

| Rule / Constant | Value / Formula | Source & Confidence |
|---|---|---|
| Crane height above rail | `1,369 mm` | Reference drawing p.4 (estimate when capacity ≠ 10 t or span ≠ 25 m) |
| Roof clearance | `200 mm` | Reference drawing p.4 |
| Required headroom above rail (R1) | `1,369 + 200 = 1,569 mm` | Derived; matches p.4 (`1569`) exactly |
| Min. building clear height (R2) | `railHeight + 1,569 mm` | Derived; blocking check if `buildingHeightMm` provided |
| Hook below girder (highest) | `620 mm` | Reference drawing p.4 (**datum interpreted** as girder underside) |
| Girder underside above rail (R4) | `7,900 + 620 − 8,321 = 199 mm` | Derived from R4; depends on 620 mm datum interpretation |
| Max. achievable lift height (R5) | `railHeight − 421 mm` | Derived (`620 − 199 = 421`); reproduces `8,321 − 421 = 7,900` exactly; always tagged as estimate |
| Asymmetric hook approaches | Left `920 mm`, Right `1,150 mm` | Reference drawing p.4 (`Min.920`, `Min.1150`) |
| Hook coverage across span (R8) | `span − 920 − 1,150 mm` | Derived |
| Overall bridge length (R6) | `span + 2 × 135 mm` | Derived from `25,270 − 25,000 = 270`; reproduces `25,270` |
| Min. wall clearance | `235 mm` per side | Reference drawing p.4 (`Min.235`); leaves `100 mm` gap to crane end (R7) |

Non-blocking **warnings** are returned in the API and rendered directly on the SVG sheet when:
- `capacityT !== 10` (real hoist clearances differ by capacity — estimate only).
- `spanMm > 25000` (longer bridge girders are typically deeper, so required headroom may be underestimated on the unsafe side).

---

## Known Limitations

- **Single reference crane envelope:** All crane-side clearances come from one `10 t / 25 m` reference drawing. Geometry does not scale automatically with capacity or girder depth; extrapolated values are flagged as estimates rather than inventing unsourced formulas.
- **Interpreted datum on `620 mm`:** Rules R4 (`199 mm`) and R5 (`421 mm` lift loss) depend on reading the `620` extension line from the girder underside. If the real datum is the rail top or flange, `maxLiftHeightMm` shifts accordingly.
- **Front elevation only:** Plan view (wheelbase `3800`, end-carriage length `4310`), Section A-A, Detail Z, and the building hall layout are not drawn.
- **No structural calculations:** Wheel loads, girder stress/deflection, rail sizing, motor power, and FEM/ISO duty classification are intentionally omitted — this is a preliminary fit/offer drawing, not a construction spec.
- **Symmetric building clearance:** `wallClearanceMm` is assumed identical on the left and right walls.
- **Local single-user setup:** No authentication, multi-user locking, or revision history table (edits update in place).
- **Native SQLite module:** `better-sqlite3` v13 provides prebuilt binaries for Node 20/22/24 on common platforms, but an unsupported Node version may require a local C++ toolchain.

---

## Time Spent

<!-- TODO: Replace with your exact real hours spent (including writing DECISIONS.md and recording the demo video) before submitting -->
- **Real hours spent:** ~`[UPDATE WITH YOUR REAL HOURS]` hours (analysis & domain review, backend/rules/drawing/frontend implementation, code review/refactoring, testing, documentation, and demo video).
