# Paper Mini Generator

In-browser tool that turns uploaded artwork into print-ready PDFs of foldable D&D paper miniatures.

**Live: https://seigiard.com/printableminimaker/**

## What it does

- Upload artwork (PNG, JPG, or WebP), pick a D&D size category, set a count.
- Add as many entries as you like.
- Transparent or flat-colour margins are trimmed to the figure. For opaque artwork, the background is the median border colour, with a tolerance of 12 per RGB channel. Details close to that colour may also be trimmed. Turn off **Normalize artwork** to print the original artwork; this setting is saved. Artwork with an uneven border or no detectable figure stays unchanged, with a warning.
- Trimmed artwork is stored as PNG to avoid another lossy compression pass. Trimming a JPEG can increase the PDF size; turning off normalization keeps the original JPEG bytes.
- **Figure margin** adds paper around each face without shrinking the figure. It defaults to 2 mm and is saved across reloads. It also applies when normalization is off; set it to 0 for no added margin. The gap between minis stays at 2 mm.
- Generate a multi-page A4 or Letter PDF, packed greedily by size.
- Each mini has a front image, dotted fold line, back image (rotated 180°), and matching tabs that double up under the base when folded. Faint outlines mark the tab boundaries. Cut around the figure freehand, leaving a rim and keeping the tabs attached to the figure. The artwork's background colour remains inside the image rectangle; only transparent or white areas leave a white rim.

Everything runs client-side. No uploads leave your browser.

## D&D sizes

A size category fixes how tall a figure prints. Its width then follows the artwork, so a broad
creature prints broad and a slim one slim, and both stand the right height beside each other.

| Size       | Figure height | Base width |
| ---------- | ------------- | ---------- |
| Tiny       | 24 mm         | 20 mm      |
| Small      | 25 mm         | 25 mm      |
| Medium     | 30 mm         | 25 mm      |
| Large      | 44 mm         | 37 mm      |
| Huge       | 60 mm         | 50 mm      |
| Gargantuan | 90 mm         | 75 mm      |

Base width is the width of the tab, not a map square: it keeps the mini standing and signals
relative size, and artwork may overhang it the way wings and horns overhang a plastic base. A
figure spread out sideways is capped at twice its base width, and hitting that cap scales the whole
figure down rather than cropping it, so that mini prints a little shorter than its category.

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
