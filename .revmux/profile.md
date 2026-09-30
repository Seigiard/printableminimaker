# Paper Mini Generator — review calibration

## What this is

A vanilla TypeScript single-page app that turns uploaded artwork into a print-ready PDF of
foldable paper miniatures. Image decode, layout and PDF generation all happen in the browser.
No server, no backend, no account, no analytics. Artwork never leaves the page and is held in
memory only; `localStorage` under `pmg-settings` holds a handful of preferences and nothing else.

Deployed to GitHub Pages. `vite.config.ts` sets `base: './'`, so the built bundle must also run
from `file://`. One runtime dependency: `pdf-lib`.

## What a real failure looks like here

The output is paper. A geometry defect is not observed until somebody has spent ink, card stock
and an evening with scissors, and it cannot be hotfixed for the sheets already printed. That is
the blast radius; weigh severity against it.

Failures worth reporting, roughly in order:

- **Wrong millimetres on the sheet.** A figure at the wrong scale, a tab too narrow to stand, a
  fold line that does not cross the whole cut-out piece.
- **Minis that overlap.** The gap exists so cutting one mini never reaches its neighbour. Any
  change that lets a figure overhang into the next column is a cutting defect, not a layout nit.
- **A mini silently dropped.** `packMinis` omits an entry that is not packable yet and reports one
  too large for the page as skipped. An entry that vanishes from neither list, or is dropped
  without reaching `oversizedEntryIndices`, costs the user a mini they believed they had.
- **The estimate disagreeing with the PDF.** `main.ts` and `pdf.ts` both call `packEntries` so the
  live "N minis → M pages" readout and the generated file cannot drift. A change that moves one
  side only is a real defect even when both sides are individually correct.
- **Artwork cropped rather than scaled.** Hitting a cap scales the whole figure down with its
  aspect ratio intact. Cropping loses the user's art and is never the right answer.
- **A document that would mislead the next agent.** `CLAUDE.md`, `CONTEXT.md` and `docs/adr/` are
  read by agents as instructions. A statement in them that no longer matches the code is a
  defect, not a tidiness issue.

## Traps specific to this codebase

- **`PackedMini` carries three widths and picking the wrong one is silent.** `baseWidthMm` is the
  footprint, `totalWidthMm` is the reserved column including margins, `tabWidthMm` is what the tab
  outlines are drawn at. They coincide in some cases and diverge in others.
- **`PackedMini.entryIndex` means different things on each side.** In `main.ts` it indexes `rows`;
  in `pdf.ts` it indexes the filtered `valid` snapshot, which `images[]` also follows.
- **Units.** Millimetres throughout the logic; points only at draw time via `mm()`. Packing walks
  top-down while PDF coordinates run bottom-up, and `drawMini` does the flip. Arithmetic that
  collapses cleanly in millimetres does not always collapse in points.
- **`index.html` owns the DOM contract.** `main.ts` queries fixed element ids at module load, so a
  renamed id breaks the app at startup with no type error.
- **Trimming is a heuristic.** `figure-bounds.ts` falls back to the median of border pixels for
  opaque artwork. A figure whose colour sits near the background's losing detail is a known,
  accepted limit — not a bug to re-report.

## Deliberate conventions — do not report these

- **No test framework and no linter, on purpose.** Tests are plain `node:assert/strict` scripts run
  by Node's type stripping, each with a local `t(name, fn)` helper that throws, and each new file is
  appended to the `test` script in `package.json` by hand. Do not propose Vitest, Jest, ESLint,
  Prettier, or a coverage tool.
- `tsconfig.json` excludes `src/**/*.test.ts` so the build typechecks only shipped code. Intended.
- Non-null casts on `document.getElementById` at module load in `main.ts`. Intended, see above.
- **`SPEC.md` is the v1 spec and the code has outgrown it.** It is kept for the exclusions it argues
  — URL paste, knockout, separate front/back artwork — not as a description of current behaviour.
  Do not report the code disagreeing with it.
- **ADR-0001 is superseded by ADR-0002 and kept as a historical record.** It contradicts current
  behaviour by design. Do not report that contradiction.
- Comments state the reason, the constraint or the gotcha, never what the code already says.
  A sparse comment is the convention, not an omission.
- British spelling in prose and comments: centred, millimetres, colour.
- Vanilla DOM throughout. Do not propose a framework, a state library, or a build-step addition.

## Vocabulary

`CONTEXT.md` is the glossary and marks avoided synonyms beside each term. Use its terms in finding
titles and bodies: mini, figure, artwork, base width, figure height, size category, entry, sheet,
tab, fold line, gap. Not: token, model, sprite, page, row, padding.

If a finding contradicts an ADR in `docs/adr/`, say so explicitly and name the ADR rather than
silently overriding it.

## Reporting bar

Report a defect a user would see on paper or in the mini count, a change that would make a later
run wrong, or a document that would mislead an agent executing it. Finding nothing is a valid
answer here.

Do not report: style preferences, naming taste, missing abstraction layers, speculative
extensibility, tooling this project has deliberately gone without, or a missing test whose only
possible assertion would restate this patch.
