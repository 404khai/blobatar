# @blobatar/react-native

## 2.5.0

### Minor Changes

- 5591cd9: React Native and Expo adapter.
  
  `@blobatar/react-native` renders through `react-native-svg`, from a new
  `_marks` export on `blobatar/internal`: the figure as drawing primitives
  rather than as markup, because React Native has no `innerHTML` and its
  `<Image>` does not decode SVG, so neither of the existing rendering modes ports.
  
  Additive throughout: a new package, a new `internal` export, nothing renamed or
  removed. `size` is required on this adapter and there is no `animate`, because
  the motion layer is CSS, which the platform does not have. `expression` works in
  full.
- 7b75abe: The idle layer on React Native, on the UI thread.
  
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
- 49984b6: Morphing between expressions on React Native.
  
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
