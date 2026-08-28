---
"blobatar": minor
---

Add `blobatar/gaze` and `blobatar/gaze.css`: the pointer-driven gaze layer, §4.5 of the motion spec, and the only motion layer with a JavaScript half.

Import the stylesheet once beside `blobatar/motion.css`, set `--mo-track-travel` on the blobatars that should follow the pointer, and run the driver on the `<svg>`:

```js
import "blobatar/motion.css";
import "blobatar/gaze.css";
import { gaze } from "blobatar/gaze";

const g = gaze(svg); // g.lookAt({ x, y }) aims it somewhere else; g.stop() tears it down
```

Nothing changes for anyone who does not import it. `--mo-track-travel` is registered with an initial value of `0px`, so the stylesheet alone resolves to the identity on every blobatar, and the entry is separate from `motion.css` precisely so a page with no pointer driver pays nothing for it.

The driver writes custom properties and never a class, because a class added imperatively races the framework for `className` and loses quietly. It parks its rAF loop once the eyes settle, watches `prefers-reduced-motion` and `(hover: hover) and (pointer: fine)` live rather than sampling them once, and stands the idle saccade down through `--mo-track-hold` so a blobatar does not glance away at random while it is watching you.

The eyes are marks on a sphere, not stickers sliding on a disc. `project` lifts
each eye onto the unit sphere, rotates it about the face's centre and projects it
back, so it foreshortens as it turns and cannot pass the limb — asked for more
excursion than the head is wide, an eye parks at the edge with no width left and
vanishes into it rather than sliding out over the page. Nothing clips anything:
there is no `clipPath` and no id, so many blobatars on one page still cannot
collide.

The head is an ellipsoid fitted to the actual silhouette, not to its bounding
box, and inset by the eyes' own size. The roster does not agree on one number —
the largest safe ellipse is 0.98 of the box on `round` and 0.39 on `triangle` —
so the driver measures it per blobatar on attach, in viewBox units that scrolling
cannot change. Across 400 seeds and every shape, no eye leaves a silhouette in
the documented 1.5 to 4 range.

The cues that used to be tuned per stop for the idle glance are consequences
here. Foreshortening is the cosine of the turned longitude; the eye leading into
a turn is nearer the limb and compresses harder because that is where it is,
not because a coefficient says so; and the convergence tilt is the product of the
two sines, which vanishes on the pure axes exactly where a real face shows no
tilt. §4.8 of the motion spec is the whole argument.

`travel` is unchanged and still a distance in viewBox units. It is read as an arc
rather than a slide, and for a small turn the two agree to within a percent, so a
face at the documented 1.5 to 4 units moves exactly as far as before. Larger
values now saturate at the limb instead of leaving the head.

`step` and `project` underneath it are the pursuit and the projection as pure
arithmetic, with no clock and no DOM, for renderers that solve frames out of
order.
