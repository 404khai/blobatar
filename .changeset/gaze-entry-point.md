---
"blobatar": minor
---

Add `blobatar/gaze` and `blobatar/gaze.css`: the pointer-driven gaze layer, §4.5 of the motion spec, and the only motion layer with a JavaScript half.

Import the stylesheet once beside `blobatar/motion.css`, set `--mo-track-travel` on the blobatars that should follow the pointer, and run the driver on the `<svg>`:

```js
import "blobatar/motion.css";
import "blobatar/gaze.css";
import { gaze } from "blobatar/gaze";

const g = gaze(svg, { target: "pointer" }); // g.stop() tears it down
```

A driver is armed by construction and aimed by a target. `gaze(svg)` alone watches nothing: the default is `null`, so the layer is running, the eyes are home, and the idle glance is untouched until something asks for them. `lookAt` is the seam that asks, and it takes a point in client coordinates, an element, or one of two words:

```js
g.lookAt({ x: caretX, y: caretY }); // a caret, a card, a spot in the viewport
g.lookAt(button); // an element: its centre, re-read as the page moves
g.lookAt("pointer"); // the cursor
g.lookAt("rest"); // its own centre, held: deliberately not looking
g.lookAt(null); // nothing — the eyes ease home and the idle glance comes back
```

`"rest"` and `null` are both "stop looking at that", and they are two different requests: `"rest"` keeps the idle glance stood down so the stillness reads as a face choosing not to look, while `null` hands the blobatar back to its own life with the driver still attached and still watching. Neither is `stop()`, which is teardown and snaps. Passing an element is the one worth reaching for: the driver already re-reads its own box on scroll, resize and its own resizes, so a watched element rides on the same machinery instead of the caller writing those listeners by hand.

Following the pointer is a target like the others rather than what a driver does when nobody said otherwise. That costs one argument at every call site that wants it, and it buys a layer where nothing starts moving implicitly — worth knowing if you set the excursion and see a face that never moves, because that symptom now has two causes and both are visible from the call site.

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
