# blobatar — workspace

Deterministic geometric blobatars from any string. No dependencies, ~3.3 KB
gzipped.

| Path                 | What it is                                                |
| -------------------- | --------------------------------------------------------- |
| `packages/blobatar` | The library. [Docs here](./packages/blobatar/README.md). |
| `apps/site`          | The landing page. Static, dark-only.                      |
| `apps/demo`          | The tuning grid — the internal design tool, not a demo.   |

```sh
bun install
bun dev        # tuning grid   → localhost:3001
bun site       # landing page  → localhost:3000
bun test       # library tests
bun run check  # tests + size budgets
```

[`CONTEXT.md`](./CONTEXT.md) is the glossary — worth two minutes before changing
anything, since `variant`, `shape` and the `name`/`seed` split mean specific and
easily-confused things here. Architectural decisions live in [`docs/adr/`](./docs/adr/).
