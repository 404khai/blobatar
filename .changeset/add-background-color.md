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

It has no effect unless a backdrop is drawn, since there is no plate to color otherwise, and an explicit `palette.bg` still wins if both are given.

Unlike `palette: { bg }`, it keeps the contrast guarantee: a `#rgb`/`#rrggbb` plate takes the default backdrop's place in the contrast floors, so the body is pushed off the color that is actually drawn instead of vanishing into it. Any other CSS color (`var(--x)`, a named color) is painted as given. Blobatars without a `backgroundColor`, or without a backdrop, render byte-identically to before.

Every adapter (`@blobatar/react`, `@blobatar/vue`, `@blobatar/solid`, `@blobatar/preact`, `@blobatar/svelte`, `@blobatar/react-native`) forwards the new prop the same way it forwards `background`, and the Flutter port gains `BlobatarOptions.backgroundColor` with the same behaviour.
