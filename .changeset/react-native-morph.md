---
"@blobatar/react-native": minor
"blobatar": minor
---

Morphing between expressions on React Native.

`MorphingBlobatar` animates the change from one `expression` to the next
instead of cutting to it, on the same clocks and the same curve the stylesheet
uses: 300ms adopting an expression, 400ms returning to idle. It takes the same
props as `Blobatar` and interrupts cleanly, starting from wherever the face
actually is rather than from the pose it set out from.

A second component rather than a `morph` prop, because a prop on one component
is reachable whether or not anybody passes it: this way a bundler drops the
whole 1.1 kB for an app that never names it, and the still `Blobatar` stays
where it was.

Core grows `_posed` on `blobatar/internal`, the sibling of `_marks` that leaves
the pose as numbers instead of baking it into the geometry, plus
`poseTransforms`, `lerpPose` and `fadeHex`. No path data is regenerated during
a morph. A frame is thirteen numbers and one transform per eye, which is the
same property the web side has. The pose composition moves from
`src/expression.ts` into a new `src/morph.ts`, so reaching for it no longer
drags the fourteen-pose roster into a bundle that imported none of them.

Additive throughout: nothing renamed or removed, `Blobatar` unchanged, and the
idle layer still absent, because it is a stylesheet gated on `:hover` and this
platform has neither.
