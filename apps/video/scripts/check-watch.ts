/**
 * The four things the gaze film cannot show if they are not true.
 *
 * Every one of these is a shot that still *renders*, which is why they are
 * checked rather than left to a viewing. A film where the eyes are damped to
 * nothing, or where the pointer is off the edge of the frame, or where a
 * hundred and twenty creatures flick at once, looks like a deliberate choice at
 * a glance and only reads as broken on the third watch.
 */

import { traits } from "blobatar";
import { layout } from "blobatar/blob";
/* Imported, not restated. These assertions are only worth something if they are
   checked against the same numbers the film is solved with, and a local copy
   would keep passing while the two silently drifted apart. */
import { DEADZONE, SNAP } from "blobatar/gaze";
import {
  B_CARD,
  CAST,
  CUT,
  B_PULL,
  BLOB,
  COUNT,
  ICON,
  END,
  ENGAGE,
  ENTER,
  HEIGHT,
  PULL_TO,
  SHOWCASE,
  SWAP,
  burstAt,
  cookieScaleAt,
  HERO_COL,
  HERO_ROW,
  COLS,
  OPEN,
  WIDTH,
  HERO,
  camera,
  cursorAt,
  holdAt,
  lookAt,
  seconds,
} from "../src/watch";

const fail = (msg: string) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

/*
 * 1. The close shot has motion in it.
 *
 * The deadzone correctly eases the excursion to nothing as the pointer
 * approaches a blobatar's centre, because there is no direction to look in at
 * something you are already on. An orbit tuned inside that radius would
 * therefore produce a perfectly correct film of a creature not moving its eyes.
 */
const heroRadius = (BLOB * OPEN) / 2;
let closest = Infinity;
for (let f = ENGAGE; f < B_PULL; f++) {
  const c = cursorAt(f);
  closest = Math.min(closest, Math.hypot(c.x - WIDTH / 2, c.y - HEIGHT / 2));
}
if (closest <= heroRadius * DEADZONE) {
  fail(
    `the cursor comes within ${closest.toFixed(0)}px of the hero in the close ` +
      `shot, inside its ${(heroRadius * DEADZONE).toFixed(0)}px deadzone, so ` +
      `the excursion is damped away. Raise HERO_RX/HERO_RY in src/watch.ts`,
  );
}

/*
 * 2. The pointer is in the frame for every frame it is drawn on.
 *
 * It is parked off the right edge before `ENTER` on purpose, and it must be
 * fully inside from `ENGAGE` onward, because that is the frame the field starts
 * treating it as a thing worth looking at.
 */
const MARGIN = 30;
for (let f = ENGAGE; f < B_CARD; f++) {
  const c = cursorAt(f);
  if (c.x < MARGIN || c.x > WIDTH - MARGIN || c.y < MARGIN || c.y > HEIGHT - MARGIN) {
    fail(
      `the cursor leaves the frame at frame ${f} (${c.x.toFixed(0)}, ` +
        `${c.y.toFixed(0)}). Lower FIELD_RX/FIELD_RY in src/watch.ts`,
    );
  }
}
if (cursorAt(ENTER - 1).x <= WIDTH) {
  fail("the cursor is already in shot before ENTER, so the film has no before half");
}

/*
 * 3. Nobody saccades.
 *
 * `SNAP` exists so that a pointer which is *replaced* rather than moved gets a
 * jump instead of a glide, and it is right to have. But the camera moves every
 * blobatar's screen centre at once during the pull back, and a snap threshold
 * crossed there fires on the whole field on the same frame, which reads as a
 * dropped frame rather than as a hundred and twenty decisions. The film is
 * supposed to be smooth pursuit end to end.
 */
for (let f = 1; f < END; f++) {
  for (let i = 0; i < COUNT; i++) {
    const a = lookAt(f - 1, i);
    const b = lookAt(f, i);
    const moved = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (moved >= SNAP) {
      fail(
        `cell ${i} moves ${moved.toFixed(2)} of the excursion in one frame at ` +
          `frame ${f}, which is a saccade. Slow the orbit or the pull back`,
      );
    }
  }
}

/*
 * 4. The film ends looking at the card.
 *
 * The last beat is the whole field converged on the words, so the hero has to
 * have actually arrived by the final frame rather than still be easing toward
 * it. Checked as a direction, since the excursion is a unit vector.
 */
const last = END - 1;
const cursor = cursorAt(last);
/* At scale 1 the camera pins the hero's centre to the point it returns, so this
   is the hero's screen position on the final frame. */
const hero = camera(last);
const want = Math.atan2(cursor.y - hero.y, cursor.x - hero.x);
const [gx, gy] = lookAt(last, HERO_ROW * COLS + HERO_COL);
const got = Math.atan2(gy, gx);
/* Signed difference folded into [-pi, pi], so a wrap at the branch cut does not
   read as half a turn of error. */
const off = Math.abs(((want - got + Math.PI * 3) % (Math.PI * 2)) - Math.PI);

if (Math.hypot(gx, gy) < 0.9) {
  fail(`the film ends mid-glide at ${Math.hypot(gx, gy).toFixed(2)} of the excursion`);
}
if (off > 0.05) {
  fail(`the hero ends ${((off * 180) / Math.PI).toFixed(1)}deg off the card`);
}

/*
 * 5. Nothing in the cast is a silhouette the film cut.
 *
 * `CAST` walks a seed until it lands outside `CUT`, and it gives up after sixty
 * tries rather than looping. Giving up is silent and leaves one cell holding
 * the shape the whole exercise was about, which is exactly the kind of thing
 * nobody spots in a 120-cell frame.
 */
const shapes = new Map<string, number>();
for (const name of [...CAST, HERO]) {
  const shape = layout(traits(name)).shape;
  shapes.set(shape, (shapes.get(shape) ?? 0) + 1);
  if (CUT.has(shape)) fail(`${name} is ${shape}, which the film cuts. See CUT in src/watch.ts`);
}
if (new Set(CAST).size !== CAST.length) fail("the cast has a duplicate name");

/*
 * 6. The reaction is over before the wide shot is.
 *
 * `surprised` costs gaze legibility: measured on a render, a full excursion
 * under it reads as almost no glance at all, because a bigger eye makes the
 * same translate a smaller displacement relative to itself. That is affordable
 * for the thirty frames where the shot is a reaction, and it is not affordable
 * for the shot the whole film is building to. If the release ever runs past the
 * camera settling, the wide shot is the film's best frames with its worst eyes.
 */
if (burstAt(PULL_TO) !== 0) {
  fail(
    `the field is still ${(burstAt(PULL_TO) * 100).toFixed(0)}% into surprised ` +
      `when the camera lands, so the wide shot opens on the pose that damps the ` +
      `excursion. Shorten BURST_HOLD or move BURST earlier in src/watch.ts`,
  );
}
if (burstAt(SWAP) !== 0) fail("the field reacts before the cookie arrives, which is not cause and effect");
if (burstAt(B_CARD) !== 0) fail("the card lands on a field of surprised faces");

/*
 * 7. The cookie holds its size relative to the creatures.
 *
 * It is an object in the room and not a mark on the glass, so it has to shrink
 * with the grid. Held constant in frame pixels it inflates 3.7x across the pull
 * back, from 14% of a blobatar to 50%, and ends up covering the face it is
 * sitting on: the frame then reads as a cookie with some blobatars behind it
 * rather than as a hundred and twenty creatures looking at a small thing.
 *
 * Checked as a ratio over every frame it is drawn on, because the failure is
 * gradual. There is no frame where it is obviously wrong, only a first frame
 * and a last frame that disagree.
 */
let widest = 0;
let narrowest = Infinity;
for (let f = SWAP; f < B_CARD; f++) {
  const share = (ICON * cookieScaleAt(f)) / (BLOB * camera(f).scale);
  widest = Math.max(widest, share);
  narrowest = Math.min(narrowest, share);
}
if (widest - narrowest > 0.005) {
  fail(
    `the cookie runs from ${(narrowest * 100).toFixed(0)}% to ` +
      `${(widest * 100).toFixed(0)}% of a blobatar, so it grows as the grid ` +
      `zooms out. See cookieScaleAt in src/watch.ts`,
  );
}

/*
 * The showcase beat shows nine *different* silhouettes.
 *
 * This is the one assertion in the film that guards a claim rather than a
 * number. The beat exists to show that the fitted head adapts to whatever
 * outline it is given, and it makes that case by putting nine of them on screen
 * at once. A seed whose band moved would quietly turn that into eight shapes and
 * a duplicate, which renders perfectly and is no longer an argument.
 *
 * Pure, so it lives here rather than in `check-gaze.ts`: a name's silhouette
 * comes from the band table and needs no browser. `check-gaze.ts` measures how
 * big each of those heads is, which does.
 */
const seen = new Map<string, string>();
for (const s of SHOWCASE) {
  const shape = layout(traits(s.name)).shape;
  const already = seen.get(shape);
  if (already) {
    fail(
      `the showcase has two ${shape}s, ${already} and ${s.name}, so the beat ` +
        `shows eight silhouettes rather than nine. Reseed one in SHOWCASE`,
    );
  }
  if (shape === "organic") {
    fail(
      `${s.name} is an organic, which the showcase deliberately leaves out: it ` +
        `is the least distinct outline on the roster. Reseed it in SHOWCASE`,
    );
  }
  seen.set(shape, s.name);
}
if (seen.size !== 9) {
  fail(`the showcase has ${seen.size} cells, not the nine the 3x3 block needs`);
}

if (holdAt(ENTER) !== 0) fail("the idle rove is already standing down before the cursor arrives");
if (holdAt(END - 1) < 0.999) fail("the idle rove never fully stands down");

console.log(
  `✓ gaze film: ${seconds.toFixed(1)}s, ${COUNT} blobatars, cursor engages at ` +
    `frame ${ENGAGE}`,
);
console.log(
  `  cast: ${[...shapes].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join(", ")}`,
);
console.log(
  `  closest approach ${closest.toFixed(0)}px vs a ` +
    `${(heroRadius * DEADZONE).toFixed(0)}px deadzone, no frame exceeds ` +
    `${SNAP} of the excursion, cookie holds ${(widest * 100).toFixed(0)}% of a ` +
    `blobatar, hero ends ${((off * 180) / Math.PI).toFixed(1)}deg ` +
    `off the card`,
);
