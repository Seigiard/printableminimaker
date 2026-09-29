# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root: the glossary.
- **`docs/adr/`**: the ADRs touching the area you're about to work in.

A missing file is the normal state: **proceed silently** and get on with the work. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) writes them lazily, once a term or a decision actually gets resolved.

## File structure

This repo is single-context: one `CONTEXT.md` and one `docs/adr/`, both at the root. A repo that later grows contexts grows a root `CONTEXT-MAP.md` pointing at per-context `CONTEXT.md` files, each with its own `src/<context>/docs/adr/`.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as `CONTEXT.md` defines it. Where the glossary marks a synonym as avoided, the defined term is the one that ships.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
