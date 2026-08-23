---
"@blobatar/react-native": minor
"blobatar": minor
---

The idle layer on React Native.

`AnimatedBlobatar` runs the ambient motion: breathe, bob, blink, the glance and
its foreshortening, plus the two loops that belong to an expression rather than
to the ambient layer, `thinking`'s seesaw and `mad`'s tremor. It morphs between
expressions too, so it is `MorphingBlobatar` with the motion added rather than
an alternative to it, and a third export rather than a prop so an app pays for
the tier it names.

`animate` is a boolean the caller drives, defaulting to false. On the web the
idle layer is gated on `:hover`, which does not exist on a touch screen, and
`motion.css` already says so by pausing every loop under `@media not ((hover:
hover) and (pointer: fine))`. So the only mode this platform has is the
always-on one, and *when* is a question the app can answer and a component
drawn into a scroll view cannot. Turning it on or off ramps over 400ms, which
is the stylesheet's own transition.

Core grows `blobatar/idle`, a new entry point beside `blobatar/expression`:
`idleAt` evaluates all seven loops as a pure function of elapsed time, and
`idleTransforms` composes them onto the six nesting levels the stylesheet
decorates. It is its own entry point rather than part of `blobatar/internal`
because keyframe tables are array literals, which a bundler does not drop the
way it drops an unreferenced function, and putting them on the shared seam
charged every adapter 2.9 kB for loops it never runs.

The seeded timings behind the loops now come from one derivation,
`motionSeeds`, which `motionVars` serializes for the stylesheet and the idle
layer reads directly. That costs about 60 B on every adapter that animates and
buys the property the whole motion layer rests on: a blobatar breathes on the
same offset on both platforms, and a grid is a crowd rather than a heartbeat.

Not Reanimated. A library has to ship worklets pre-compiled, which means a
Babel pass over a package built with Bun, a peer dependency with a native build
step, and a copy of the composition inside the worklet, since a worklet cannot
call core's `idleTransforms`. Every animating blobatar therefore re-renders per
frame on the JS thread, which is what makes `animate` being the caller's the
load-bearing half of the design.

Additive throughout: nothing renamed or removed, and `Blobatar` unchanged at
the byte it was.
