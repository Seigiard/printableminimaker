# Paper Mini Generator — agent guide

Guidance for coding agents working in this repository. Reachable as both `CLAUDE.md` and `AGENTS.md`; the latter is a symlink.

## Commands

`package.json` carries `dev`, `build`, `preview` and `test`. What it does not say:

```bash
node --experimental-strip-types src/packing.test.ts   # one test file
```

Tests are plain `node:assert/strict` scripts run by Node's type stripping, each with a local `t(name, fn)` helper that throws on failure — no framework, no linter. Write new tests the same way and append the file to the `test` script by hand.

`tsconfig.json` excludes `src/**/*.test.ts`, so `npm run build` typechecks only shipped code. `npm test` is what exercises the tests.

## Architecture

Vanilla TypeScript SPA. Image decode, layout and PDF generation all happen in the browser; there is no backend and no framework.

**`src/packing.ts` is the single source of layout truth.** Pure module — no DOM, no `pdf-lib`. Both `main.ts` and `pdf.ts` call `packEntries()`, which projects artwork dimensions into the geometry-only `packMinis()` input. New layout constants and rules belong here so the estimate and output stay in step.

**Prepared artwork owns bytes and dimensions together.** `artwork.ts` prepares each file once and converts WebP to PNG. Original PNG dimensions come from IHDR; JPEG dimensions come from the PDF decoder's header parser. `Entry.image` retains the original file. `Entry.artwork` holds that prepared original or the trimmed derivative from `normalization.ts`, and is `null` while loading. Thumbnails, estimates and PDFs consume it. Replacement and normalization changes clear it immediately; late results publish only for the entry's latest load token while the entry is still in `rows`.

**Normalization currently trims by alpha.** `figure-bounds.ts` is the pure pixel-buffer seam. `normalization.ts` serializes full-image trim work, memoizes results per prepared original, and returns the original with a warning if no bounds are found or processing fails. The uniform per-mini margin in the domain model is a later ticket.

**`PackedMini.entryIndex` means different things on each side.** In `main.ts` it indexes `rows` directly. In `pdf.ts` it indexes the *filtered* `valid` snapshot — entries with prepared artwork, a positive count and a resolvable width. `images[]` follows `valid` order. Preserve that alignment when touching either.

**Units.** Millimetres throughout the logic; `pdf.ts` converts to points at draw time via `mm()`. Packing walks top-down (`yTopMm` descending) while PDF coordinates run bottom-up, and `drawMini` does the flip.

**Per-mini geometry.** Unfolded, bottom to top: front tab, front image, fold line, back image, back tab. The back face is drawn under a 180° CTM (`concatTransformationMatrix(-1, 0, 0, -1, …)`) between `pushGraphicsState`/`popGraphicsState`, so its number badge uses the same local coordinates as the front one and lands in the matching visual corner.

**`MAX_HEIGHT_RATIO` holds height monotonic with size category.** The cap in `sizes.ts` keeps image height at or under 1.5× the base width, so a Large mini always permits a taller figure than a Small one. Tall art is scaled down and centred over its footprint (`imageOffsetXMm`), aspect preserved, uncropped. `sizes.test.ts` guards this.

**`index.html` owns the DOM contract.** `main.ts` queries fixed element ids with non-null casts at module load, so renaming an id breaks the app at startup with no type error. Row-list changes rebuild the DOM: mutate `rows`, call `render()`. A late artwork load patches only its thumbnail and calls `updateCount()`, preserving focus in editable fields.

## Scope notes

`SPEC.md` is the v1 spec, and the code has outgrown it. Read it for the deliberate exclusions it argues: URL paste (image hosts send no permissive CORS headers, so a fetch→canvas→PDF path fails regardless of where the site is hosted), background removal, separate front/back artwork.

Artwork stays in memory only. `localStorage` under `pmg-settings` holds page size, the numbering toggle and the normalization toggle.

GitHub Pages serves the site from the Actions workflow. On this fork the `on: push` trigger does not
fire — GitHub gates push-triggered workflows on forks — so a deploy needs
`gh workflow run deploy.yml --ref main` until someone enables workflows from the repository's Actions tab.
`vite.config.ts` sets `base: './'`, which also lets the built bundle run from `file://`.

## Agent skills

- **Filing, reading, labelling or closing an issue** — GitHub Issues on `Seigiard/printableminimaker` via `gh`, plus the wayfinder map conventions: `docs/agents/issue-tracker.md`.
- **Triaging** — the five canonical roles, each label string equal to its name, all five live in the tracker: `docs/agents/triage-labels.md`.
- **Exploring the codebase** — single-context domain docs at the repo root, created lazily: `docs/agents/domain.md`.
