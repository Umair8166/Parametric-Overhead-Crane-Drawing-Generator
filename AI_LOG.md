# AI Usage Log

## Tools Used and What For

- **Antigravity (AI coding assistant):**
  - Extracting and inspecting the assignment PDF, including rendering high-resolution zoomed crops of the vector reference drawing on page 4 so every dimension, label, and inconsistency could be verified visually.
  - Helping evaluate stack trade-offs (ultimately choosing Node.js + TypeScript + Express 5 + Zod + `better-sqlite3` + React/Vite to match my MERN background).
  - Scaffolding the npm workspaces setup, backend modules (`rules.ts`, `validation.ts`, `db.ts`, `drawing.ts`, `routes/designs.ts`), React frontend (`client/src/`), and Vitest + `supertest` test suite.
  - Rendering generated SVG drawings to PNGs to inspect dimension spacing and text legibility across multiple crane sizes.
- **Not used for:** `DECISIONS.md` was written completely by hand, in my own words, without AI assistance.

---

## Key Prompts Used

1. **Assignment & Reference Drawing Analysis (before coding):**
   > Asked the AI to read all pages of the assignment PDF — inspecting the actual visuals and zooming into the reference drawing on page 4 rather than relying only on extracted text — explain the crane engineering terms in simple language, separate confirmed facts from assumptions/ambiguities, and produce a prioritized 4-hour implementation roadmap without writing any code yet.

2. **Stack Selection & Honest Pushback:**
   > Reviewed the AI's initial Python/FastAPI recommendation and pushed back: *"I'm a MERN Stack Developer with nearly 4 years of experience. So I think the better stack for me would be Node.js + TypeScript, Express, Zod, better-sqlite3, server-side SVG with no drawing library, Vitest + supertest, and Vite + React served by Express via `npm install && npm start`. Tell me honestly if you disagree."*

3. **Complexity Review & Refactoring Check (after Step 2):**
   > Paused before Step 3 to review the generated code and challenged it directly: *"Don't you think our current implementation might be unnecessarily complex? I believe we should keep the code as simple and easy to understand as possible, especially because we may need to explain our technical decisions in an interview. Be brutally honest."*

4. **Route vs. Controller Separation Trade-off (after Step 3):**
   > Asked whether `server/src/routes/designs.ts` should be split into separate routes and controllers/services, requesting an honest critique rather than blind agreement. After reviewing that domain math (`rules.ts`), validation (`validation.ts`), SQL (`db.ts`), and SVG generation (`drawing.ts`) were already isolated, we intentionally kept `routes/designs.ts` as thin HTTP glue instead of adding pass-through layers.

---

## Times the AI Was Wrong (and How I Caught & Fixed It)

### 1. Overengineered / Verbose `rules.ts` (caught via manual code review — commit `a129e2c`)
- **What went wrong:** In Step 2, the AI generated a **535-line** `server/src/rules.ts` for roughly 10 lines of crane addition/subtraction. It duplicated constants across a 25-field `DerivedDimensions` interface and a 180-line repetitive `dimensions` array, added unused constants from Detail Z and Plan View (`wheelDiameterMm`, `railSectionWidthMm`, `pendantBottomAboveFloorMm`), and made `rules.ts` import `validation.ts` (Zod), reversing the clean dependency direction.
- **How I caught it:** I paused before Step 3, opened `server/src/rules.ts` and `validation.ts`, and noticed the boilerplate felt heavier than the problem warranted and would be hard to justify cleanly in an interview.
- **Fix:** Refactored `rules.ts` and `validation.ts` in commit `a129e2c`, deleting **307 net lines**, making `rules.ts` completely dependency-free (zero imports), removing unused constants, and extracting a small `intMm()` helper in `validation.ts` while keeping all 16 unit tests passing.

### 2. SVG Layout Overlap & `supertest` Binary Response Bug (caught via visual inspection & tests — Step 4)
- **What went wrong:**
  1. In the first version of `server/src/drawing.ts`, the drawing viewport (`left: 130, width: 710`) left too little margin on the right, so the `9,890` / `12,200` building-height dimension crossed the panel divider at `x = 904` and overlapped the Technical Data text. It also used SVG2 `fill="context-stroke"` arrowheads and `<pattern>` fills that failed to render cleanly outside Chrome.
  2. In `server/test/designs.api.test.ts`, the AI asserted `expect(download.text).toContain(...)` on `GET /api/designs/:id/drawing.svg`, which failed because `supertest` (`superagent`) parses `image/svg+xml` as a binary `Buffer` (`download.body`) rather than `download.text`.
- **How we caught & fixed them:** Running `npm test` immediately surfaced the `supertest` failure (fixed to read `download.body.toString('utf8')`), and rendering 3 sample SVGs (reference crane, extrapolated 5 t / 28 m crane, and tight 5 m bay) to PNGs and inspecting them visually caught the right-side text collision and marker rendering issues before committing `5853806`.
