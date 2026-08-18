/**
 * Every trait key gen1 reads, including the indexed families it only reaches
 * for some shapes.
 *
 * Now spread across `styles/compose.ts` (the body and eye ranges every
 * generation shares) and `styles/shapes.ts` (the per-silhouette families like
 * `nub.a0` and `cloud.r0`), which is exactly why this stays a hand-written
 * list: the keys a generation reads are a property of its band table, and no
 * single module has them all any more.
 *
 * Kept as a list rather than derived, because the point of the tests that use
 * it is to sweep the configuration surface as a *caller* sees it — a list
 * scraped from the implementation would agree with the implementation by
 * construction, including where the implementation is wrong.
 */
export const BLOB_KEYS = [
  "shape",
  "hue",
  "tone",
  "body.r",
  "body.ratio",
  "body.x",
  "body.y",
  "body.n",
  "body.rot",
  "body.pts",
  ...Array.from({ length: 8 }, (_, i) => `body.r${i}`),
  "gaze.x",
  "gaze.y",
  "eye.rx",
  "eye.ratio",
  "eye.scale",
  "eye.stretch",
  "eye.gap",
  "eye.n",
  "eye.lean",
  "eye.lean2",
  "eye.dy",
  "sun.n",
  "sun.dist",
  "sun.r",
  "sun.rot",
  "cloud.n",
  ...Array.from({ length: 6 }, (_, i) => `cloud.r${i}`),
  "nub.n",
  "nub.a0",
  "nub.a1",
  "nub.r0",
  "nub.r1",
];

/**
 * The same, for gen2.
 *
 * A separate list rather than a superset of the one above, for the reason the
 * one above is a list at all. gen2 shares most of gen1's keys — a seed's
 * `body.r` position is the same number in both — but it drops none and adds
 * five, and a union would hide which generation reads which.
 */
export const BLOB2_KEYS = [
  ...BLOB_KEYS,
  "poly.round",
  "capsule.squat",
  "droplet.w",
  "droplet.tip",
  "droplet.n",
];
