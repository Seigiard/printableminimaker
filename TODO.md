# Height-driven sizing — run checklist

Spec: [#20](https://github.com/Seigiard/printableminimaker/issues/20). Tickets are a strict
chain: each one edits the surface the next one builds on.

## Progress

Review base: 9fe859ecb2c1fc5cd8a4b65702b99cf97fc1bd19

- [x] #16 · two-column size table and a temporary sizing-model switch (landed on main in #21)
- [x] #17 · scale a figure by its category's height, with a width cap
- [x] #18 · keep the tab at its base width and let the figure overhang
- [ ] #19 · remove the losing sizing model and its switch
      blocked 2026-09-29: waits on which model wins, judged by looking at printed sheets

Both models therefore ship behind the switch, which defaults to the width model, so nothing
a user sees changes until that judgement is made.
