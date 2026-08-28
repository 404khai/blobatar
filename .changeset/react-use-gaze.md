---
"@blobatar/react": minor
---

Add `@blobatar/react/gaze`: a `useGaze()` hook for the pointer-driven gaze layer.

```tsx
import { Blobatar } from "@blobatar/react";
import { useGaze } from "@blobatar/react/gaze";
import "blobatar/gaze.css";

const { ref, lookAt, home } = useGaze({ travel: 3 });
<Blobatar ref={ref} name={user.email} animate="always" size={200} />;
```

`travel` is the excursion in viewBox units, and it is what opts a blobatar into the layer — `--mo-track-travel` starts at `0px`, so a page with the stylesheet loaded and the excursion set nowhere has a driver running and no eyes moving. Omit it and the stylesheet owns the property instead, which stays the better route for a whole field of blobatars (it inherits) or for anything responsive. Do not set both. The hook writes the property inline on the `<svg>` and `gaze.css` reads it on the `.mo-eyes` group inside, so a rule matching that group directly is a declaration on the element and beats the inherited inline value however it was written; the symptom is a face that renders perfectly and never moves. There is no default, so the two never collide unless you opt into both. The hook also remeasures after writing it, and that matters more than it looks: the driver caches the excursion as an angle as well as deriving its write threshold from it, so without the remeasure a changed `travel` would not reach the projection until the next scroll.

A separate subpath rather than a prop on `<Blobatar>`, and the same bargain `@blobatar/react-native/animated` already makes: importing `Blobatar` links no pointer driver, so a consumer rendering static avatars in a list pays nothing. The adapter's own code is unchanged at 76 B gzipped; the hook is 418 B, and 2385 B with the driver it pulls in.

`ref` is a callback ref, so the driver's life follows the element's exactly and a conditionally rendered blobatar detaches without anything needing a dependency array. `lookAt`, `home` and `remeasure` are stable across renders. `home()` aims the eyes at the blobatar's own centre, which is how you stop the gaze without handing it back to the pointer.

`GazeOptions.at` is deliberately not forwarded: it is construction-time sugar on the driver, and a construction-time option that looks declarative is a trap in React. `lookAt` is the seam for aiming, at every point in the component's life.
