# morphatar — workspace

Deterministic geometric avatars from any string. No dependencies, ~3.3 KB
gzipped.

| Path                 | What it is                                                    |
| -------------------- | ------------------------------------------------------------- |
| `packages/morphatar` | The library. [Docs here](./packages/morphatar/README.md).      |
| `apps/site`          | The landing page. Static, dark-only.                           |
| `apps/demo`          | The tuning grid — the internal design tool, not a demo.        |

```sh
bun install
bun dev        # tuning grid   → localhost:3001
bun site       # landing page  → localhost:3000
bun test       # library tests
bun run check  # tests + size budgets
```

[`CONTEXT.md`](./CONTEXT.md) is the glossary — worth two minutes before changing
anything, since `variant`, `shape` and `seed` mean specific and easily-confused
things here. Architectural decisions live in [`docs/adr/`](./docs/adr/).
