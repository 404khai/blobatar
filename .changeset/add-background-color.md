---
"blobatar": minor
"@blobatar/react": minor
"@blobatar/vue": minor
"@blobatar/solid": minor
"@blobatar/preact": minor
"@blobatar/svelte": minor
"@blobatar/react-native": minor
---

Add `backgroundColor`, a direct way to set the backdrop's fill color.

```ts
blobatar(user.email, { background: "circle", backgroundColor: "#fef3c7" });
```

Shorthand for `palette: { bg: "#fef3c7" }` — it has no effect unless `background` also resolves truthy, since there is no plate to color otherwise, and an explicit `palette.bg` still wins if both are given. Every adapter (`@blobatar/react`, `@blobatar/vue`, `@blobatar/solid`, `@blobatar/preact`, `@blobatar/svelte`, `@blobatar/react-native`) forwards the new prop the same way it forwards `background`.
