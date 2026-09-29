# Height-driven sizing — run checklist

Spec: [#20](https://github.com/Seigiard/printableminimaker/issues/20). Tickets are a strict
chain: each one edits the surface the next one builds on.

## Progress

Review base: 9fe859ecb2c1fc5cd8a4b65702b99cf97fc1bd19

- [x] #16 · two-column size table and a temporary sizing-model switch (landed on main in #21)
- [x] #17 · scale a figure by its category's height, with a width cap
- [x] #18 · keep the tab at its base width and let the figure overhang
- [x] #19 · remove the losing sizing model and its switch

The chain is complete. The height model won the comparison on 2026-09-29, judged on two PDFs
of the same seven rows: under the width model the halfling printed taller than the dwarf beside
it. The switch, `SIZE_WIDTH_MM`, `MAX_HEIGHT_RATIO` and the `SizingModel` type are gone, and a
`sizingModel` left in `pmg-settings` by either version is ignored and dropped on the next save.

Follow-up: [#24](https://github.com/Seigiard/printableminimaker/issues/24) regrades the size
table. One height per category is too coarse, because a category spans an octave of real
height and Medium holds both the dwarf and the bugbear.
