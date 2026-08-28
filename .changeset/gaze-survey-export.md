---
"blobatar": minor
---

Export `survey()` and `Face` from `blobatar/gaze`: the fitted head and eye marks the projection turns on, measured off a rendered blobatar.

```js
import { project, survey } from "blobatar/gaze";

const face = survey(svg); // { marks, rx, ry } in viewBox units, or null
const p = project(face.marks[0], travel / face.rx, travel / face.ry);
```

This is the measurement `gaze()` already did in its closure, lifted out unchanged. Nothing about the driver's behaviour moves: it calls this and assigns the result.

It is exported because the driver is not the only thing that has to know where an eye rests. `step` and `project` are pure so that a renderer solving frames out of order can use them. `apps/video` integrates its whole pursuit forwards at module load, because the filter is recursive and Remotion hands frames to several workers in arbitrary order. But the projection needs geometry as well as arithmetic, and the fitted ellipsoid is the one input that cannot be derived from a name: it is found by bisection against the rendered silhouette and lands at 0.98 of the box on `round` and 0.39 on `triangle`. Without this, anything not running the driver had to keep a second copy of that fit, which would go on rendering plausibly while the two quietly disagreed about where the limb is.

`survey(el)` takes the `<svg>` and returns `null` for a subtree with no layout box (`display: none`, or detached), which is a blobatar that cannot be looked at anyway. `rx` and `ry` are semi-axes in viewBox units and `marks` are fractions of them, already normalised for `project`, so neither number changes when the page scrolls or the blobatar is drawn at a different size. The marks come back in `querySelectorAll(".mo-eye")` order, which is the order `--mo-gz-*1` and `--mo-gz-*2` are picked apart by.
