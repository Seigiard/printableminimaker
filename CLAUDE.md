# Paper Mini Generator — agent guide

Guidance for coding agents working in this repository. Reachable as both `CLAUDE.md` and `AGENTS.md`; the latter is a symlink.

## Commands

`package.json` carries `dev`, `build`, `preview` and `test`. What it does not say:

```bash
node --experimental-strip-types src/packing.test.ts   # one test file
```

Tests are plain `node:assert/strict` scripts run by Node's type stripping, each with a local `t(name, fn)` helper that throws on failure — no framework, no linter. Write new tests the same way and append the file to the `test` script by hand.

`tsconfig.json` excludes `src/**/*.test.ts`, so `npm run build` typechecks only shipped code. `npm test` is what exercises them, and CI runs it before the build.

## Architecture

Vanilla TypeScript SPA: image decode, layout and PDF generation all happen in the browser.

**`src/packing.ts` is the single source of layout truth.** Pure module — no DOM, no `pdf-lib`. Both `main.ts` and `pdf.ts` call `packEntries()`, which projects artwork dimensions into the geometry-only `packMinis()` input. New layout constants and rules belong here so the estimate and the output stay in step.

Each `PackedMini` carries three widths and they are not interchangeable. `baseWidthMm` is the base's footprint, fixed by the size category. `totalWidthMm` is the wider of figure and base plus a figure margin on each side, and sets the reserved column and the fold-line span — under the height model a figure may overhang its base, which is why the reservation takes the greater of the two. `tabWidthMm` is what the tab outlines are drawn at: the base width under the height model, so a wide pose claims no more table than a narrow creature of its category, and the whole reserved column under the width model, where tabs have always spanned the mini.

**`Entry.artwork` is what the whole pipeline reads** — thumbnails, estimates and PDFs alike. It holds either the prepared original or the trimmed derivative, and is `null` while loading. `Entry.image` keeps the original `File`, so turning normalization off re-derives instead of asking the user to upload again.

**`artwork.ts` prepares each file once**, converting WebP to PNG. Dimensions come from the bytes that will actually print, rather than from a browser decode that may have applied EXIF rotation: PNG from the IHDR chunk, JPEG from the PDF library's header parser.

**Trimmed derivatives are always PNG, JPEG inputs included.** Re-encoding a trimmed JPEG would compress it lossily a second time; the cost is that the PDF can grow. Turning normalization off restores the original bytes.

**`figure-bounds.ts` is the pure pixel-buffer seam** and holds all of the detection logic. Any transparency in the artwork selects the alpha path; fully opaque artwork falls back to the median of its border pixels and rejects a border that disagrees with itself. Colour trimming is a heuristic: a figure whose own colour sits near the background's can lose detail at that edge.

**`normalization.ts` wraps that seam in canvas work.** It serializes trims so only one full-resolution bitmap exists at a time, memoizes per prepared original, and on either no-bounds or an outright failure returns the original with a warning rather than a broken image. The figure margin stays out of this: it is layout geometry applied outside the base width at pack and draw time, it leaves artwork bytes untouched, and it applies whether normalization ran or not.

**`PackedMini.entryIndex` means different things on each side.** In `main.ts` it indexes `rows` directly. In `pdf.ts` it indexes the *filtered* `valid` snapshot — entries with prepared artwork, a positive count, and the dimensions their sizing model needs, which is `hasPackableDimensions`, the same rule the packer applies — and `images[]` follows `valid` order. Preserve that alignment when touching either.

**Units.** Millimetres throughout the logic; `pdf.ts` converts to points at draw time via `mm()`. Packing walks top-down (`yTopMm` descending) while PDF coordinates run bottom-up, and `drawMini` does the flip.

**Per-mini geometry.** Unfolded, bottom to top: front tab, margin, front image, margin, fold line, margin, back image, margin, back tab. Across the mini, base and tab are centred in the reserved column and the figure is centred over them, so an overhang is symmetric; the fold line spans the whole column, because the crease has to cross every part of the cut-out piece. The back face is drawn under a 180° CTM (`concatTransformationMatrix(-1, 0, 0, -1, …)`) between `pushGraphicsState`/`popGraphicsState`, so its number badge uses the same local coordinates as the front one and lands in the matching visual corner.

**Deleting a sizing model means finding every branch on it, and they are not all in one place.** Geometry branches twice: `fitFigure` in `sizes.ts` decides the figure's size, `packMinis` in `packing.ts` decides the tab's width, and both reach the model through `PackOptions.sizingModel`, threaded once rather than added to every signature between. `drawMini` is clean — it draws the packed geometry and never asks which model produced it — but `generatePDF` does branch, sharing the packer's dimension rule so it embeds artwork only for rows that will be drawn. `main.ts` branches three more times: the size labels in `sizeLabel()`, and the per-row custom figure-height field's visibility, which is set in two places. Each model caps the axis the other one fixes: the width model scales to the base width and `MAX_HEIGHT_RATIO` caps height at 1.5× it, so a Large mini always permits a taller figure than a Small one; the height model takes the height from the size category and `MAX_WIDTH_RATIO` caps width at 2× the base. Either cap scales the whole figure down and centres it over its footprint (`imageOffsetXMm`), aspect preserved, uncropped. `sizes.test.ts` guards both.

**`index.html` owns the DOM contract.** `main.ts` queries fixed element ids with non-null casts at module load, so renaming an id breaks the app at startup with no type error. Row-list changes rebuild the DOM: mutate `rows`, call `render()`. Artwork loads asynchronously and races: a result publishes only while its entry still holds that load's token and still sits in `rows`, and it patches its own thumbnail rather than re-rendering, which keeps focus in an editable field.

## Scope notes

`SPEC.md` is the v1 spec, and the code has outgrown it — trimming shipped, for one. Read it for the exclusions it argues and the code still honours: URL paste (image hosts send no permissive CORS headers, so a fetch→canvas→PDF path fails wherever the site is hosted), knockout, separate front/back artwork.

Artwork stays in memory only. `localStorage` under `pmg-settings` holds page size, figure margin, the numbering toggle, the normalization toggle and `sizingModel`. The model selection is a temporary preview setting, and #19 removes the losing model and the switch with it.

GitHub Pages deploys from the Actions workflow on push to `main`. `vite.config.ts` sets `base: './'`, which also lets the built bundle run from `file://`.

## Agent skills

- **Filing, reading, labelling or closing an issue** — GitHub Issues on `Seigiard/printableminimaker` via `gh`, plus the wayfinder map conventions: `docs/agents/issue-tracker.md`.
- **Triaging** — the five canonical roles, each label string equal to its name, all five live in the tracker: `docs/agents/triage-labels.md`.
- **Exploring the codebase** — the glossary in `CONTEXT.md` and the ADRs in `docs/adr/`, and when to read each: `docs/agents/domain.md`.
