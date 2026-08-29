---
"@blobatar/solid": patch
"blobatar": patch
---

Fix the Solid adapter rebuilding its `<svg>` on every prop change, and finish documenting the gaze bindings.

The branch between the two rendering modes was a ternary inside a dynamic child expression, which Solid compiles to one computation: it re-ran whenever anything it read changed — a new `name`, a new `hue`, a new size — and re-running it built a fresh element and swapped it in. That is the failure the comment inside the `<svg>` is about, one level up. A fresh element has no previous computed value, so every idle animation under it restarted from phase zero on any prop change, and anything holding the old element — a gaze driver, most obviously — was left measuring a node that had left the document. It was the only adapter that did this; React, Preact, Vue and Svelte all keep the element and update its attributes.

It is a non-keyed `<Show>` now, which memoizes on the condition rather than on the value, so the branch is built once and stays while `parts()` keeps returning something. Everything inside is an ordinary reactive attribute updated in place. 19 B on the adapter's row.

`packages/harness/scripts/probe-gaze.ts` grew the check that would have caught it, asked of every adapter: the `<svg>` a binding was given is still the same element after a prop change. Checked by identity, which is the only way to see it, since the rebuilt element renders identically.

`packages/blobatar/README.md` and the site's docs page still described the gaze as React's alone. Both now name all five bindings.
