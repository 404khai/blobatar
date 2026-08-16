# Font sources

The originals. `../fonts/` holds Latin subsets of these, and those are what ship
— the full variable files are ~141 KB together, which on a simulated slow-4G
connection is the single largest contributor to LCP on the landing page. The
subsets are ~44 KB and cover every glyph the site actually renders.

This directory is deliberately *not* under `fonts/`: `build.ts` copies that
directory into `dist` wholesale, so a nested `source/` would ship too.

## Regenerating

Needs `fonttools` (`pip install fonttools brotli`), which is why this is a
manual step committed to the repo rather than something `bun run build` does —
the build stays dependency-free and runs on Vercel unchanged.

```sh
cd apps/site
for f in geist-variable geist-mono-variable; do
  pyftsubset "fonts-src/$f.woff2" \
    --output-file="fonts/$f.woff2" \
    --flavor=woff2 \
    --layout-features='kern,liga,calt' \
    --unicodes='U+0020-007E,U+00A0-00FF,U+2010-2027,U+2030-205E,U+20AC,U+2122,U+2190-2193,U+2212'
done
```

The range is Basic Latin + Latin-1 Supplement + General Punctuation, plus the
euro, trademark, arrows and minus signs. Widen it if the copy ever grows a
character outside that — the failure mode is a silent fallback-font glyph, not
an error, so check visually after changing any prose.
