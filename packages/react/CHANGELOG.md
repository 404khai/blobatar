# @blobatar/react

## 2.6.0

### Minor Changes

- 5163644: Add `@blobatar/react/gaze`: a `useGaze()` hook for the pointer-driven gaze layer.
  
  ```tsx
  import { Blobatar } from "@blobatar/react";
  import { useGaze } from "@blobatar/react/gaze";
  import "blobatar/gaze.css";
  
  const { ref } = useGaze({ travel: 3, lookAt: "pointer" });
  <Blobatar ref={ref} name={user.email} animate="always" size={200} />;
  ```
  
  `travel` is the excursion in viewBox units, and it is what opts a blobatar into the layer — `--mo-track-travel` starts at `0px`, so a page with the stylesheet loaded and the excursion set nowhere has a driver running and no eyes moving. Omit it and the stylesheet owns the property instead, which stays the better route for a whole field of blobatars (it inherits) or for anything responsive. Do not set both. The hook writes the property inline on the `<svg>` and `gaze.css` reads it on the `.mo-eyes` group inside, so a rule matching that group directly is a declaration on the element and beats the inherited inline value however it was written; the symptom is a face that renders perfectly and never moves. There is no default, so the two never collide unless you opt into both. The hook also remeasures after writing it, and that matters more than it looks: the driver caches the excursion as an angle as well as deriving its write threshold from it, so without the remeasure a changed `travel` would not reach the projection until the next scroll.
  
  A separate subpath rather than a prop on `<Blobatar>`, and the same bargain `@blobatar/react-native/animated` already makes: importing `Blobatar` links no pointer driver, so a consumer rendering static avatars in a list pays nothing. The adapter's own code is unchanged at 76 B gzipped; the hook is 351 B, and 2519 B with the driver it pulls in.
  
  `ref` is a callback ref, so the driver's life follows the element's exactly and a conditionally rendered blobatar detaches without anything needing a dependency array. `lookAt` and `remeasure` are stable across renders.
  
  A blobatar looks at nothing until it is aimed, `"pointer"` included. The `lookAt` **option** is where a component declares a target that does not change, which is most of them, and the returned `lookAt` **function** is for one that does — a caret, a card under the cursor, a step in a tour. Both take the driver's whole `GazeTarget` union, so a ref works where an element does (`lookAt(button.current)`) and `lookAt("rest")` parks the eyes in the middle without handing them back to the pointer. The option is re-applied whenever it changes and the function wins in between, so the two mix: declare the usual answer, call for the exceptions.
  
  `GazeOptions.target` is not forwarded under its own name, because on the driver it is construction-time sugar read once, and a construction-time option that looks declarative is the classic React trap. The `lookAt` option is applied on mount and on every change, which is the declarative thing it looks like. Aiming before the blobatar mounts is a queued request rather than a no-op either way: the hook holds the last target asked for and hands it to the driver as it builds it, which also means retuning `settle` or `snap` — which does rebuild the driver — no longer quietly stops the gaze.

## 2.5.0

## 2.4.0

## 2.3.1

### Patch Changes

- Document the shadcn/ui registry item, and add `shadcn` keywords so the packages
  are findable from that side.
  
  No runtime change: the READMEs and the `keywords` arrays are the whole diff.
  This is a release because an npm package page is written by a publish and by
  nothing else, so the registry item stays invisible on the two pages most likely
  to be read until one happens.

## 2.3.0

## 2.2.0

### Minor Changes

- 011915a: Adapters are published under their own names: **`@blobatar/react`** and **`@blobatar/vue`**.
  
  Nothing breaks. `blobatar/react` and `blobatar/vue` keep working and render exactly what they always did — the new packages re-export them, so they are the same component and cannot drift. Move when it suits you:
  
  ```sh
  bunx blobatar-codemod .
  bun add @blobatar/react
  ```
  
  The old subpaths are deprecated and frozen, and go in v3. They are also the last two: adapters added from here on are packages only, so `blobatar`'s optional peer list stops growing at `react` and `vue` instead of naming every framework the library ever supports.
  
  Also new: `blobatar/internal` (`_parts`, `_layout`, `serializeVars`), the entry point adapters build against. Its shape changes only on a major, together with every `@blobatar/*` package. It is not a general-purpose API — `blobatar()` and `blobatarUri()` remain the public answers for rendering markup.
  
  No blobatar changes. Faces are byte-identical to the previous release.
