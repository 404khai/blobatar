---
"@blobatar/react-native": minor
"blobatar": minor
---

The idle layer on React Native, on the UI thread.

`AnimatedBlobatar`, from the new `@blobatar/react-native/animated` entry point,
runs the ambient motion: breathe, bob, blink, the glance and its
foreshortening, plus the two loops that belong to an expression rather than to
the ambient layer, `thinking`'s seesaw and `mad`'s tremor. It morphs between
expressions too, so it is `MorphingBlobatar` with the motion added.

The loops are Reanimated worklets, so a screen full of blobatars animating at
once costs no React render per frame. `react-native-reanimated` and
`react-native-worklets` are optional peer dependencies, needed only by that
subpath: `Blobatar` and `MorphingBlobatar` stay at the package root and link
neither. The published adapter compiles its own worklets, through a Babel step
the build now runs and then verifies, because an untransformed `'worklet'`
directive is an ordinary function that silently runs on the JS thread.

`animate` is a boolean the caller drives, defaulting to false. On the web the
idle layer is gated on `:hover`, which does not exist on a touch screen, and
`motion.css` already says so by pausing every loop under `@media not ((hover:
hover) and (pointer: fine))`. So the only mode this platform has is the
always-on one, and *when* is a question the app can answer and a component
drawn into a scroll view cannot. Turning it on or off ramps over 400ms, which
is the stylesheet's own transition, and lands on exactly the still blobatar.

Core grows `blobatar/idle`: `idleAt` evaluates all seven loops as a pure
function of elapsed time, and `idleTransforms` composes them onto the nesting
levels the stylesheet decorates. Its own entry point rather than part of
`blobatar/internal`, because keyframe tables are array literals, which a
bundler does not drop the way it drops an unreferenced function.

The loops therefore exist twice, in core and as worklets, since a worklet
cannot call an imported function. `packages/harness` runs both over a sweep of
seeds, times and amplitudes and asserts they agree exactly, so a transcription
error fails CI rather than waiting for a device. The pose composition is not
duplicated: it stays in core and runs in JavaScript, and the seesaw reaches it
as an outer translate that composes exactly.

The seeded timings behind the loops now come from one derivation,
`motionSeeds`, which `motionVars` serializes for the stylesheet and the idle
layer reads directly. That costs about 60 B on every adapter that animates and
buys the property the whole motion layer rests on: a blobatar breathes on the
same offset on both platforms, and a grid is a crowd rather than a heartbeat.

Additive throughout: nothing renamed or removed, and `Blobatar` unchanged.
