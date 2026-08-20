---
"@blobatar/svelte": minor
"@blobatar/solid": minor
"@blobatar/preact": minor
---

Add Svelte, Solid, and Preact adapters

Each adapter is a separate package that peer-depends on `blobatar` with an
exact major range (`2.x`) plus its own framework peer. The adapters use
`blobatar/internal` for `_parts` and `blobatar/uri` for `blobatarUri`.

- Svelte adapter uses Svelte 5 runes (`$props`, `$derived`)
- Solid adapter uses SolidJS primitives (`createMemo`)
- Preact adapter uses Preact hooks (`useMemo`)

All adapters support both static (image URL) and animated (SVG generation) modes.
