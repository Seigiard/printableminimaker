# Paper Mini Generator

In-browser tool that turns uploaded artwork into print-ready PDFs of foldable D&D paper miniatures.

**Live: https://seigiard.com/printableminimaker/**

## What it does

- Upload artwork (PNG, JPG, or WebP), pick a height, set a count.
- Add as many entries as you like.
- Transparent or flat-colour margins are trimmed to the figure. For opaque artwork, the background is the median border colour, with a tolerance of 12 per RGB channel. Details close to that colour may also be trimmed. Turn off **Normalize artwork** to print the original artwork; this setting is saved. Artwork with an uneven border or no detectable figure stays unchanged, with a warning.
- Trimmed artwork is stored as PNG to avoid another lossy compression pass. Trimming a JPEG can increase the PDF size; turning off normalization keeps the original JPEG bytes.
- **Figure margin** adds paper around each face without shrinking the figure. It defaults to 2 mm and is saved across reloads. It also applies when normalization is off; set it to 0 for no added margin. The gap between minis stays at 2 mm.
- Generate a multi-page A4 or Letter PDF, packed greedily by size.
- Each mini has a front image, dotted fold line, back image (rotated 180°), and matching tabs that double up under the base when folded. Faint outlines mark the tab boundaries. Cut around the figure freehand, leaving a rim and keeping the tabs attached to the figure. The artwork's background colour remains inside the image rectangle; only transparent or white areas leave a white rim.

Everything runs client-side. No uploads leave your browser.

## Sizes

You pick how tall a figure prints. Its width then follows the artwork, so a broad creature prints
broad and a slim one slim, and both stand the right height beside each other.

The choice is a height, not a D&D size category, because a category spans an octave of real height:
Medium runs 4 to 8 feet, so a dwarf and a bugbear are both Medium and used to print identically.
Medium and Large are therefore graded finer — three slots and two — and the category comes along
with the height you pick, since it is what sets the base width.

| Height           | Typical                          | Category   | Figure | Base  |
| ---------------- | -------------------------------- | ---------- | ------ | ----- |
| ~2'              | familiar, imp, hawk              | Tiny       | 11 mm  | 20 mm |
| ~3'2"            | halfling, gnome, goblin, kobold  | Small      | 17 mm  | 25 mm |
| 4'3"             | dwarf                            | Medium     | 23 mm  | 25 mm |
| 5'8"             | human, elf, orc                  | Medium     | 30 mm  | 25 mm |
| ~7'              | bugbear, goliath                 | Medium     | 37 mm  | 25 mm |
| ~9'              | ogre, troll, owlbear             | Large      | 48 mm  | 37 mm |
| ~13'             | hill giant, young dragon         | Large      | 69 mm  | 37 mm |
| ~20'             | giant, adult dragon              | Huge       | 95 mm  | 50 mm |
| 32'+             | ancient dragon, kraken           | Gargantuan | 111 mm | 75 mm |

The scale is a human at 5'8" printing 30 mm, held linear at 5.3 mm per foot. The top two rows bend,
because the paper runs out before the creatures do: at that scale a 32-ft dragon is a 170 mm figure
needing a 363 mm sheet. Huge and Gargantuan are cut short enough to leave room for a wider figure
margin, so 20 and 32+ feet print only 17% apart.

Base width is the width of the tab, not a map square: it keeps the mini standing and signals
relative size, and artwork may overhang it the way wings and horns overhang a plastic base. A
figure is never wider than one and a half times the height its row quotes; artwork wider than that
is scaled down whole rather than cropped, keeping its own proportions, so a figure drawn with its
arms spread prints shorter than its row — at 4:1, a third of it. The scale-down is proportional to
the row, so rows still print in order.

The tab is 8 mm, except under a figure too short to carry one: it shrinks to at most 40% of the
figure, down to a floor of 4 mm, so a Tiny stands 2.5× its own tab instead of reading as a strip of
paper with a dot on top. The floor is where the proportion stops — the fold needs something to grip,
so a figure scaled below about 10 mm by the width cap ends up with a tab of its own size or larger.

## Run locally

```bash
npm install
npm run dev      # local preview at http://localhost:5173
npm run build    # static site in dist/
```

The built `dist/` is a plain static bundle — host it anywhere (GitHub Pages, Cloudflare Pages, `file://`, whatever).

## Stack

Vanilla TypeScript, Vite, [pdf-lib](https://pdf-lib.js.org/). Cut and fold lines are vector PDF paths; uploaded images are embedded once and placed by reference.

## Scope

See [SPEC.md](./SPEC.md) for the v1 spec, including what's deliberately left out (URL paste, background removal, separate front/back artwork).

## License

[MIT](./LICENSE)
