# Paper Mini Generator — agent guide

Guidance for coding agents working in this repository. Reachable as both `CLAUDE.md` and `AGENTS.md`; the latter is a symlink.

## Commands

`package.json` carries `dev`, `build`, `preview` and `test`. What it does not say:

```bash
node --experimental-strip-types src/packing.test.ts   # one test file
```

Tests are plain `node:assert/strict` scripts run by Node's type stripping, each with a local `t(name, fn)` helper that throws on failure — no framework, no linter. Write new tests the same way and append the file to the `test` script by hand.

`tsconfig.json` excludes `src/**/*.test.ts`, so `npm run build` typechecks only shipped code. `npm test` is what exercises them, and `ci.yml` runs it before the build on every pull request and every push to `main`.

## Architecture

Vanilla TypeScript SPA: image decode, layout and PDF generation all happen in the browser.

**`src/packing.ts` is the single source of layout truth.** Pure module — no DOM, no `pdf-lib`. Both `main.ts` and `pdf.ts` call `packEntries()`, which projects artwork dimensions into the geometry-only `packMinis()` input. New layout constants and rules belong here so the estimate and the output stay in step.

Each `PackedMini` carries three widths, and reaching for the wrong one is a silent bug. `baseWidthMm` is the base's footprint, fixed by the size category the entry's height slot carries. `totalWidthMm` reserves the wider of figure and base plus a figure margin each side, and spans the fold line — a figure may overhang its base. `tabWidthMm` is what the tab outlines are drawn at, and it is the base width — a wide pose claims no more table than a narrow creature of the same category.

It also carries `tabHeightMm`, which is **not** the `TAB_HEIGHT_MM` constant. `tabHeightMm()` shrinks the tab under a figure too short to carry a full one, so both `pdf.ts` and `totalHeightMm` must read the mini's own field; the constant is only the ceiling. It is derived from the figure's *printed* height, after the width cap, not from the slot's nominal one.

**`Entry.artwork` is what the whole pipeline reads** — thumbnails, estimates and PDFs alike. It holds either the prepared original or the trimmed derivative, and is `null` while loading. `Entry.image` keeps the original `File`, so turning normalization off re-derives instead of asking the user to upload again.

**`artwork.ts` prepares each file once**, converting WebP to PNG. Dimensions come from the bytes that will actually print, rather than from a browser decode that may have applied EXIF rotation: PNG from the IHDR chunk, JPEG from the PDF library's header parser.

**Trimmed derivatives are always PNG, JPEG inputs included.** Re-encoding a trimmed JPEG would compress it lossily a second time; the cost is that the PDF can grow. Turning normalization off restores the original bytes.

**`figure-bounds.ts` is the pure pixel-buffer seam** and holds all of the detection logic. Any transparency in the artwork selects the alpha path; fully opaque artwork falls back to the median of its border pixels and rejects a border that disagrees with itself. Colour trimming is a heuristic: a figure whose own colour sits near the background's can lose detail at that edge.

**`normalization.ts` wraps that seam in canvas work.** It serializes trims so only one full-resolution bitmap exists at a time, memoizes per prepared original, and on either no-bounds or an outright failure returns the original with a warning rather than a broken image. The figure margin stays out of this: it is layout geometry applied outside the base width at pack and draw time, it leaves artwork bytes untouched, and it applies whether normalization ran or not.

**`PackedMini.entryIndex` means different things on each side.** In `main.ts` it indexes `rows` directly. In `pdf.ts` it indexes the *filtered* `valid` snapshot — entries with prepared artwork, a positive count, and both of the dimensions sizing needs, which is `hasPackableDimensions`, the same rule the packer applies — and `images[]` follows `valid` order. Preserve that alignment when touching either.

**Units.** Millimetres throughout the logic; `pdf.ts` converts to points at draw time via `mm()`. Packing walks top-down (`yTopMm` descending) while PDF coordinates run bottom-up, and `drawMini` does the flip.

**Per-mini geometry.** Unfolded, bottom to top: front tab, margin, front image, margin, fold line, margin, back image, margin, back tab. Across the mini, base and tab are centred in the reserved column and the figure is centred over them, so an overhang is symmetric; the fold line spans the whole column, because the crease has to cross every part of the cut-out piece. The back face is drawn under a 180° CTM (`concatTransformationMatrix(-1, 0, 0, -1, …)`) between `pushGraphicsState`/`popGraphicsState`, so its number badge uses the same local coordinates as the front one and lands in the matching visual corner.

**Each sheet carries a 100 mm scale bar** in its top margin, drawn after the minis and from filled rectangles only, with its note in regular Helvetica. `pdf.test.ts` reads a stroked two-point path as a fold line and a Helvetica-Bold text as a badge label, so a stroke or a bold label in the bar would be taken for part of a mini.

**A height slot fixes figure height; width follows the artwork.** `fitFigure` in `sizes.ts` is the only place a slot becomes millimetres of artwork, and `MAX_WIDTH_TO_SLOT_HEIGHT` caps width at 1.5× the height the slot prints at, so a figure spread out sideways cannot swallow the sheet — measured against that height, never the base, because a base-width cap collapses every slot of a category back to one printed height. Hitting the cap scales the whole figure down, the artwork's own proportions preserved and nothing cropped, so it bounds width rather than the printed width-to-height ratio: a 4:1 Medium prints 52.5 × 13.125 mm and is still 4:1. That mini prints short of its slot's height, and at a high enough ratio it prints much shorter. A width-driven model shipped alongside it behind a switch and lost the comparison; #19 removed it, along with `SIZE_WIDTH_MM`, `MAX_HEIGHT_RATIO`, the `SizingModel` type and the persisted setting.

**Height is the input; the size category is derived.** #24 replaced the six categories with nine `HEIGHT_SLOTS`, because a category spans an octave of real height and a dwarf and a bugbear, both Medium, used to print identically. `Entry.heightSlot` is what the user picks; `CATEGORY_BASE_WIDTH_MM` is keyed by category, so slots sharing one cannot disagree about the base. The top two rows are off the linear scale — Huge and Gargantuan are cut short so a raised figure margin cannot drop them off the sheet, since each added millimetre of margin costs four of unfolded height — and the small end stays on it only because the tab yields instead; ADR-0002 has both.

**`index.html` owns the DOM contract.** `main.ts` queries fixed element ids with non-null casts at module load, so renaming an id breaks the app at startup with no type error. Row-list changes rebuild the DOM: mutate `rows`, call `render()`. Artwork loads asynchronously and races: a result publishes only while its entry still holds that load's token and still sits in `rows`, and it patches its own thumbnail rather than re-rendering, which keeps focus in an editable field.

## Scope notes

`SPEC.md` is the v1 spec, and the code has outgrown it — trimming shipped, for one. Read it for the exclusions it argues and the code still honours: URL paste (image hosts send no permissive CORS headers, so a fetch→canvas→PDF path fails wherever the site is hosted), knockout, separate front/back artwork.

Artwork stays in memory only. `localStorage` under `pmg-settings` holds page size, figure margin, the numbering toggle and the normalization toggle. A stored `sizingModel` from the comparison switch is ignored and dropped on the next save.

GitHub Pages deploys from `deploy.yml` on push to `main`; it keeps its own copy of the test and build steps so a broken Pages setup cannot fail a pull request. `vite.config.ts` sets `base: './'`, which also lets the built bundle run from `file://`.

## Agent skills

- **Touching an issue** — GitHub Issues on `Seigiard/printableminimaker` via `gh`: `docs/agents/issue-tracker.md`.
- **Triaging** — the five canonical roles, each label string equal to its name: `docs/agents/triage-labels.md`.
- **Exploring the codebase** — the glossary in `CONTEXT.md` and the ADRs in `docs/adr/`, and when to read each: `docs/agents/domain.md`.
