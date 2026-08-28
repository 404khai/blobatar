/**
 * The gaze film: the cursor's path, the camera over it, and the solved pursuit.
 *
 * One claim, and it is the one thing about this layer a still cannot make:
 * **they watch you.** So the film is a pointer moving and a hundred and twenty
 * creatures following it, and everything below exists to make that pointer's
 * path a function of the frame rather than a recording of a hand.
 *
 * ## Same stage, same crowd, same creature
 *
 * The grid, the cell size, the hero's cell and the crowd list are `timeline.ts`
 * and `names.ts` unchanged. That is not reuse for its own sake: the launch film
 * already taught a viewer what this grid is, and a second film that rebuilt it
 * at a different pitch would be making them learn it twice to be told one new
 * thing. It also means the two films can be cut together, which is the reason
 * `Root.tsx` keeps saying "same stage".
 *
 * ## Why the pursuit is solved once rather than integrated per frame
 *
 * The eyes run an exponential filter toward their target, which is recursive:
 * frame 200 depends on frame 199. Remotion renders frames independently and out
 * of order across several tabs, so a component that integrated as it went would
 * produce a different film depending on which worker got which frame, and it
 * would do it silently. `seek.css` makes exactly this argument about the CSS
 * loops; this is the same argument one layer up.
 *
 * So the whole track is integrated at module load, forwards from frame zero,
 * and every frame reads its row. 120 creatures over 414 frames is 99,360 pairs
 * and about a millisecond, paid once per worker.
 *
 * ## Screen space, not grid space
 *
 * The camera moves under the cursor. The cursor does not move with it: it is
 * drawn in frame coordinates, at a constant size, exactly as a real one would
 * sit on a screen while the page behind it zoomed. So the pursuit has to be
 * solved against each blobatar's *screen* centre on that frame, which is its
 * grid position through the camera, and that is why `camera` lives here rather
 * than in the component.
 */

import { traits } from "blobatar";
import { layout, type Shape } from "blobatar/blob";
import { DEADZONE, SNAP, SETTLE, pursuit, smoothstep, step } from "blobatar/gaze";
import { CROWD } from "./names";
import { CELL, COLS, FPS, GRID_Y, HEIGHT, HERO, HERO_COL, HERO_ROW, ROWS, WIDTH } from "./timeline";

export { CELL, COLS, FPS, GRID_Y, HEIGHT, HERO, HERO_COL, HERO_ROW, ROWS, WIDTH } from "./timeline";

/**
 * Silhouettes this film does not use.
 *
 * The gaze is a pair of eyes moving inside a head, and how legible that is
 * depends on how still the head is. A lumpy outline gives the eye a second
 * thing to resolve in the same 92px cell, and in the wide shot, where the
 * excursion is already only ten pixels, the two compete: the frame reads as a
 * field of texture rather than as a hundred and twenty creatures pointing the
 * same way. The geometric bands have an axis you can read at a glance, so the
 * eyes are the only thing in the cell that is ambiguous, which is the shot.
 *
 * So the film keeps the six bands with a readable axis, `round`, `boxy`,
 * `capsule`, `droplet`, `hexagon` and `triangle`, and cuts the four that do
 * not have one. `organic` is the obvious cut and `sun` is the loudest: a spiky
 * outline at 92px is the one silhouette that pulls the eye harder than the eyes
 * do. `cloud` and `nub` are quieter about it and go for the same reason, since
 * a bump on a head is another thing in the cell that is not symmetric.
 *
 * `capsule` is cut for a second reason, and it is a measurement rather than a
 * taste call. Under §4.8 an eye turns on a fitted ellipsoid and the turn is
 * `travel / radius`, so the excursion a shape can take before its eyes saturate
 * at the limb is set by the *smallest* semi-axis of its head. A capsule is a
 * stadium: the cast's shortest fits at 8.5 viewBox units against a round face's
 * 31, so one excursion turns it nearly four times as far. At the travel the
 * wide shot needs it went past 70°, and the eyes arrive at the limb with almost
 * no width left: a creature staring while the field around it tracks. It is
 * the one silhouette that cannot hold the shot's excursion, and holding the
 * excursion down to what it can take would have flattened the other five.
 *
 * A set rather than a rule, because where the line falls is a taste call and
 * not a fact. Taking `cloud` back out of it is the whole edit.
 * `scripts/check-watch.ts` prints the cast's band table on every run, and
 * `scripts/check-gaze.ts` prints the fitted head of every band and fails if one
 * of them saturates, so both halves of the effect are visible without a render.
 */
export const CUT: ReadonlySet<Shape> = new Set<Shape>([
  "organic",
  "cloud",
  "nub",
  "sun",
  "capsule",
]);

const shapeOf = (name: string) => layout(traits(name)).shape;

/**
 * A nearby seed, for a name whose own silhouette is cut.
 *
 * Digits before the `@` rather than after it, so an address stays an address.
 * `names.ts` is explicit that the crowd is handles and addresses rather than
 * random strings, because the shot makes a claim about a user list, and
 * `tom@acme.com1` would quietly stop being one.
 */
const vary = (name: string, k: number) => {
  const at = name.indexOf("@");
  return at < 0 ? `${name}${k}` : `${name.slice(0, at)}${k}${name.slice(at)}`;
};

/**
 * The crowd this film casts: `names.ts`, with every cut silhouette walked to
 * the nearest seed that is not one.
 *
 * A filter-and-refill would have been simpler and is the wrong shape. The list
 * is 119 names for 119 cells and it is curated, so dropping 28 of them means
 * finding 28 from somewhere, and anything generated to fill the gap is the
 * random string `names.ts` refuses. Walking the seed keeps the name.
 *
 * Derived rather than written down for the reason every other number in this
 * file is: the band table decides which name is which silhouette, and a
 * hand-edited cast would go quietly wrong the next time it moves.
 */
export const CAST: readonly string[] = (() => {
  const out: string[] = [];
  const used = new Set<string>([HERO]);
  for (const name of CROWD) {
    /* Widened out of the literal union `names.ts` exports: a walked seed is a
       new string, and the list's type is a fact about that list rather than
       about what may stand in a cell. */
    let pick: string = name;
    for (let k = 1; k <= 60 && (CUT.has(shapeOf(pick)) || used.has(pick)); k++) {
      pick = vary(name, k);
    }
    used.add(pick);
    out.push(pick);
  }
  return out;
})();

/**
 * The showcase: nine silhouettes, one per cell, in a 3x3 block around the hero.
 *
 * ## Why these names and not the crowd's
 *
 * `CAST` walks every seed away from a cut silhouette, so by construction it can
 * never contain a `cloud`, a `nub`, a `sun` or a `capsule`, which is four of the
 * nine shapes this beat exists to show. They are placed here directly instead,
 * and the cells they occupy are taken out of `CAST`'s reach.
 *
 * ## Why a block and not a row
 *
 * A row was the first shape of this and it wasted the frame. Nine cells side by
 * side have to fit across 1920px, which caps the camera at 1.45 and draws each
 * blobatar about 130px tall in a frame that is 1080 tall: a thin strip of small
 * creatures with most of the shot empty above and below them. The silhouette is
 * the entire subject of the beat, so the silhouette wants the pixels.
 *
 * Three by three is square, so it is limited by the frame's short side instead
 * of its long one. At 2.4 the block is 922px on each side and each blobatar
 * draws two thirds larger than it did in the row.
 *
 * ## Why these seeds in particular
 *
 * Each is the largest-fitting seed found for its shape across a few hundred
 * candidates, measured with `survey()` rather than chosen by eye. That matters
 * because the fitted head varies as much *within* a shape as between shapes: the
 * cast's capsules run from 8.5 units to 16, and the turn is `travel / radius`,
 * so a badly-drawn seed saturates at the limb and sits there staring while its
 * eight neighbours track. Picking the roomiest head per shape is what lets one
 * excursion serve all nine.
 *
 * The measured fits, in viewBox units: hexagon 26.1, nub 25.9, boxy 24.7, round
 * 21.1 (the hero), sun 20.7, droplet 18.7, cloud 16.2, capsule 15.3, triangle
 * 12.1. The last is the binding constraint on `TRAVEL_WIDE`, and at that
 * excursion it turns 48° against the hexagon's 22°. That spread is the beat: one
 * excursion, nine heads, each turning as far as its own head allows.
 *
 * Handles and addresses, for the reason `names.ts` gives about the crowd: the
 * shot is making a claim about a user list, and a block of `probe32` would be
 * making a claim about a seed function.
 *
 * ## Why the arrangement
 *
 * Angular and soft alternate rather than grouping, so no two neighbours read as
 * the same silhouette at a glance. `organic` is the shape left out: it is the
 * least distinct outline on the roster and would read as a generic blob between
 * two things that do not.
 */
export const SHOWCASE: readonly { row: number; col: number; name: string }[] = [
  { row: HERO_ROW - 1, col: HERO_COL - 1, name: "mara@hey.io" }, // hexagon
  { row: HERO_ROW - 1, col: HERO_COL, name: "amara@hey.io" }, // sun
  { row: HERO_ROW - 1, col: HERO_COL + 1, name: "otto@hey.io" }, // boxy
  { row: HERO_ROW, col: HERO_COL - 1, name: "tobias.dev" }, // droplet
  { row: HERO_ROW, col: HERO_COL, name: HERO }, // round
  { row: HERO_ROW, col: HERO_COL + 1, name: "nico" }, // triangle
  { row: HERO_ROW + 1, col: HERO_COL - 1, name: "dmitri@acme.com" }, // nub
  { row: HERO_ROW + 1, col: HERO_COL, name: "cato@acme.com" }, // capsule
  { row: HERO_ROW + 1, col: HERO_COL + 1, name: "lena@acme.com" }, // cloud
];

/** The blobatar's box inside a cell, as the launch film draws it. */
export const BLOB = 124;

/** The hero's centre in grid coordinates. The camera pins this to a screen point. */
export const HERO_X = (HERO_COL + 0.5) * CELL;
export const HERO_Y = GRID_Y + (HERO_ROW + 0.5) * CELL;

/**
 * The opening scale, taken from the launch film so the hero opens at the size a
 * viewer has already seen it at. 124 at 3.7 reads 459px.
 */
export const OPEN = 3.7;

// Beat boundaries.
export const B_IN = 0;
/** The cursor's clock starts. Before this it is parked off the right edge. */
export const ENTER = 34;
export const B_PULL = 138;
/**
 * The showcase beat: the camera stops halfway out, on the hero and its eight
 * neighbours, cast as nine different silhouettes.
 *
 * The pull back used to be one move from the hero to the field. It is now two,
 * with a stop in between, because the thing §4.8 rebuilt is not visible in
 * either of the shots the film already had. Up close there is one head, so the
 * projection is demonstrated on one silhouette. In the wide shot there are a
 * hundred and twenty at 124px, where an outline is a smudge and the eyes are
 * four pixels. The claim that the head is fitted *to this silhouette* needs a
 * shot where you can see the silhouette.
 *
 * So the camera pauses at 2.4, where a 3x3 block around the hero fills the frame
 * at 298px a cell, and the hero's eight neighbours are cast as eight other
 * shapes. Nine of the roster's ten are on screen at once, all tracking the same
 * pointer, all containing their own eyes. `organic` is the one left out: it is the least
 * distinct outline on the roster, so it reads as a generic blob and makes the
 * weakest case of the ten.
 *
 * The rest of the field is mounted and transparent through all of this. It
 * arrives on the second half of the move, which is what `cellOpacity` was
 * already doing by distance and now does in two passes.
 */
export const ROW_AT = 198;
export const ROW_END = 276;

/**
 * The swap: the cursor goes and the cookie arrives in its place.
 *
 * Ten frames after the camera leaves the row, rather than on the same frame as
 * it, and that gap is the whole reason this beat works. Two large things
 * changing at once means the viewer attends to neither, so the eye is given a
 * third of a second to commit to the move and is then paid with a second event.
 *
 * It hangs off `ROW_END` rather than off `B_PULL` because the pull back is two
 * moves now, and this belongs to the second one. On the first the film is busy
 * making a different point: nine silhouettes, one pointer, and a swap in the
 * middle of it would be asking the viewer to look at the icon instead of at the
 * heads. Landing it on `PULL_TO` instead was the other option and is worse: it
 * spends the opening second of the best shot in the film on an icon animation.
 *
 * Nothing about the gaze happens here. Both icons sit on the same continuous
 * path, so the aim point does not move and no eye in the field notices the
 * swap, which is what makes this the one safe place to put a pop.
 */
export const SWAP = ROW_END + 10;

export const PULL_TO = 356;
export const B_CARD = 458;
export const END = 530;

/**
 * The orbit, in seconds, and the two radii it is drawn at.
 *
 * An ellipse rather than a hand-authored path, and that is a choice about what
 * is being demonstrated rather than laziness. Smooth pursuit is the oculomotor
 * system that tracks a target moving at a *constant, predictable* speed, and it
 * is the thing this layer models. A jittery path would be asking the eyes to
 * saccade, which is a different behaviour, and the film would be showing the
 * wrong one while claiming to show this one.
 *
 * The radii are the constraint that matters. `HERO_RX` has to clear the hero's
 * own drawn radius, 229px at `OPEN`, or the cursor spends the close shot inside
 * the face where the deadzone correctly damps the excursion to nothing and the
 * shot has no motion in it. See `scripts/check-watch.ts`, which fails the build
 * on exactly that.
 */
/**
 * The showcase beat's scale, and where the hero's centre sits while it holds.
 *
 * Three cells is 384 grid units, so at 2.4 the block is 922px square inside a
 * 1080-tall frame: as large as the short side allows with a margin that keeps it
 * off the edge. Each blobatar draws at 298px, against 459px in the close shot
 * and 124px in the field.
 *
 * `ROW_Y` is the screen point the hero's centre is pinned to, and it is the
 * frame's middle rather than the hero's own `HERO_Y`. The block is what the shot
 * is about and it is centred on the hero, so the hero goes in the middle of the
 * frame; the camera picks the 64px offset back up on the way out to the field,
 * where the grid is what has to be centred instead.
 */
const ROW_SCALE = 2.4;
const ROW_Y = HEIGHT / 2;

const ORBIT = 5.6;
const START_RX = 1180;
const START_RY = 620;
const HERO_RX = 430;
const HERO_RY = 288;
const FIELD_RX = 720;
const FIELD_RY = 396;

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
/** Cubic ease-in-out, matching `Easing.inOut(Easing.cubic)` in the components. */
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const ramp = (frame: number, from: number, to: number, a: number, b: number) =>
  a + (b - a) * ease(clamp01((frame - from) / (to - from)));


/**
 * Excursion in viewBox units, and it is the only number in the film that is a
 * function of the camera.
 *
 * A viewBox unit is `BLOB * scale / 100` screen pixels, so one excursion is 3.7
 * times bigger in the close shot than in the wide one. Held constant it
 * therefore cannot be right in both: 5 units reads beautifully on a 459px face
 * and is 4.6px on a 92px cell, which at a glance is a grid of blobatars not
 * moving their eyes.
 *
 * ## What §4.8 changed about these numbers
 *
 * They were 8 and 11 when the excursion was a translate on `.mo-eyes`, and
 * both are wrong now for opposite reasons.
 *
 * 11 was too much. `travel` is read as an arc against the *fitted* head, so the
 * turn is `travel / radius`, and the wide shot has a hundred and twenty heads
 * in it whose fits are not close to equal. At 11 the short ones went past 70°
 * and their eyes arrived at the limb with almost no width left: a field where
 * the round faces read perfectly and every capsule beside them sat shrivelled
 * and staring. That is what a saturation failure looks like from the outside:
 * not eyes leaving the head, but eyes that stop answering.
 *
 * 8 was far too little. Under the translate that was as much as the close shot
 * could take, because more of it slid the pair toward the edge of the face and
 * there was nothing to stop them. The projection has a limb, so it cannot
 * happen, and the excursion the shot can hold went up with it. 8 turns the hero
 * 22°, which is a glance. 18 turns it 49°, which is a head.
 *
 * ## Why the sphere is the register rather than a beat
 *
 * These were briefly 8 with a spike to 24 in the middle of the close shot, so
 * that the film had one moment of unmistakable sphere and was otherwise the
 * glance it had always been. That is the wrong way round. The projection runs
 * on every frame of every blobatar whatever these are set to; the excursion
 * only decides how much of it you can see. Spending four seconds on a large
 * face and showing the thing it was rebuilt for in two of them is choosing not
 * to demonstrate the feature.
 *
 * So the close shot runs at 18 the whole way through. The foreshortening, the
 * per-eye differential and the convergence tilt are visible on every frame the
 * hero is on screen, and they are what the pursuit is drawn with rather than a
 * thing that happens to it once.
 *
 * ## Both ends were found on renders
 *
 * In the close shot 8 is a shift you have to be told about, 18 is a creature
 * turning its head, and 28 takes the trailing eye small enough that it starts
 * competing with the leading one for being the thing you are looking at.
 *
 * In the wide shot the binding constraint is the smallest head in the cast, a
 * `triangle` at 11.4 units. 10 turns it 50° and its eyes stay full enough to
 * read; 12 turns it 63° and visibly pinches it along with every droplet in the
 * field, which is the same failure 11 used to produce on capsules, arriving one
 * shape later. `capsule` is cut from the cast outright rather than
 * accommodated. See `CUT`.
 *
 * The change between them rides the camera move, where nobody can see it
 * happen.
 */
export const TRAVEL_CLOSE = 18;
export const TRAVEL_WIDE = 10;

export const travelAt = (frame: number) =>
  /*
   * Ramped across the first half of the pull back rather than the whole of it,
   * so the excursion is already at its field value when the row settles.
   *
   * The row is the shot with the tightest constraint in the film. Its smallest
   * head is `nico`, a triangle fitted at 12.1 units, and nine heads spanning
   * 12.1 to 26.1 all take the same excursion: whatever the row can hold, the
   * field can too. Holding `TRAVEL_CLOSE` into the row instead would turn that
   * triangle 85°, which is the saturation failure this film was retuned to get
   * rid of, arriving in the one shot built to show the fit working.
   */
  ramp(frame, B_PULL, ROW_AT, TRAVEL_CLOSE, TRAVEL_WIDE);

/**
 * The camera, as a scale and the screen point the hero's centre is pinned to.
 *
 * The same shape the launch film uses, and written as one function over the
 * whole timeline rather than per-beat clips, because the film has no cuts and
 * this is the only thing that moves between beats.
 */
export function camera(frame: number): { scale: number; x: number; y: number } {
  if (frame < B_PULL) return { scale: OPEN, x: WIDTH / 2, y: HEIGHT / 2 };

  // The first half of the pull back: out to the row, where nine silhouettes
  // fill the frame.
  if (frame < ROW_AT)
    return {
      scale: ramp(frame, B_PULL, ROW_AT, OPEN, ROW_SCALE),
      x: WIDTH / 2,
      y: ramp(frame, B_PULL, ROW_AT, HEIGHT / 2, ROW_Y),
    };

  // The row beat itself. The camera is completely still and the only thing
  // moving is nine pairs of eyes on nine different heads.
  if (frame < ROW_END) return { scale: ROW_SCALE, x: WIDTH / 2, y: ROW_Y };

  // The second half: out to the field, and the crowd arrives around the row it
  // was already watching.
  if (frame < PULL_TO)
    return {
      scale: ramp(frame, ROW_END, PULL_TO, ROW_SCALE, 1),
      x: ramp(frame, ROW_END, PULL_TO, WIDTH / 2, HERO_X),
      y: ramp(frame, ROW_END, PULL_TO, ROW_Y, HERO_Y),
    };

  // The hold, and the card over it. The camera is completely still for the rest
  // of the film: the only thing moving is 120 pairs of eyes, which is the shot.
  return { scale: 1, x: HERO_X, y: HERO_Y };
}

/**
 * How big the cookie is drawn, relative to the size it lands at.
 *
 * The cursor and the cookie belong to different places and this is the whole of
 * the difference. A pointer is on the glass: it is the viewer's, it is not in
 * the picture, and it stays the size it is however far the page behind it
 * zooms. A cookie is in the room. It is a thing the creatures are looking at,
 * so it has to shrink with them or it is not in there with them.
 *
 * Left constant it does not merely look wrong, it takes over: measured across
 * the pull back it goes from 14% of a blobatar to 50%, a 3.7x inflation, and by
 * the wide shot it completely covers the face it is sitting on. The frame then
 * reads as a giant cookie with some blobatars behind it, when the shot is a
 * hundred and twenty creatures looking at a small thing.
 *
 * So it is pinned to the camera and holds the proportion it had on the frame it
 * popped. That leaves it genuinely small in the wide shot, which is right: the
 * convergence is what the eye is meant to follow out there, and the cookie only
 * has to be findable enough to check the convergence against.
 */
/**
 * How big the cookie is drawn on the frame it pops in on, in frame pixels.
 *
 * The one number that sets its size everywhere, because `cookieScaleAt` pins
 * the rest to the camera. It works out to a constant 27% of a blobatar for the
 * whole film: 125px next to the 457px hero at the pop, 34px next to a 124px
 * cell in the wide shot.
 *
 * Found by rendering, twice, and both ends were wrong on the way. Constant in
 * frame pixels it inflated from 14% of a blobatar to 50% and covered a face.
 * Pinned to the camera at 62px it held its proportion correctly and was 17px by
 * the wide shot, which is a speck: about the size of one eye, and the frame
 * stopped having a thing in it that the creatures were visibly looking at.
 * Proportion is the property to hold fixed and 14% was simply the wrong
 * proportion to hold.
 *
 * Here rather than in the component because `scripts/check-watch.ts` measures
 * it against a blobatar, and a number the check reads from one file and the
 * film draws from another is a number that will disagree with itself.
 */
export const ICON = 125;

export const cookieScaleAt = (frame: number) => camera(frame).scale / OPEN;

/**
 * Where the cursor is, in frame coordinates.
 *
 * Parked off the right edge until `ENTER`, so the film opens on a blobatar that
 * is merely alive: breathing, blinking, glancing wherever its own seed sends
 * it. That second and a bit is the whole before half of the argument, and it is
 * the reason the cursor's angle is measured from `ENTER` rather than from frame
 * zero. Letting the ellipse run from the start would bring it into frame on its
 * own schedule, about half a second in, and there would be nothing to compare
 * the tracking against.
 *
 * After `B_CARD` it eases to the card and stops. The field settles pointing at
 * the words, which is the last frame: everything on screen looking at the one
 * thing the viewer is reading.
 */
export function cursorAt(frame: number): { x: number; y: number } {
  const t = Math.max(0, (frame - ENTER) / FPS);
  const a = (2 * Math.PI * t) / ORBIT;

  const rx = frame < B_PULL
    ? ramp(frame, ENTER, ENTER + 52, START_RX, HERO_RX)
    : ramp(frame, B_PULL, PULL_TO + 24, HERO_RX, FIELD_RX);
  const ry = frame < B_PULL
    ? ramp(frame, ENTER, ENTER + 52, START_RY, HERO_RY)
    : ramp(frame, B_PULL, PULL_TO + 24, HERO_RY, FIELD_RY);

  const x = WIDTH / 2 + rx * Math.cos(a);
  const y = HEIGHT / 2 + ry * Math.sin(a);

  if (frame < B_CARD) return { x, y };

  // The park. Eased from wherever the orbit had reached, so the eyes glide to
  // the card rather than snapping to it: `SNAP` would fire on a jump this size
  // and 120 creatures flicking at once reads as a glitch.
  const held = cursorAt(B_CARD - 1);
  const k = ease(clamp01((frame - B_CARD) / PARK));
  return {
    x: held.x + (CARD_X - held.x) * k,
    y: held.y + (CARD_Y - held.y) * k,
  };
}

/**
 * How long the park takes.
 *
 * Long enough that no cell reads it as a jump. The path from wherever the orbit
 * had reached to the card sweeps across the field, and a cell it passes near has
 * its target direction swing through a wide angle in very few frames: not a
 * change of amplitude, which the deadzone handles, but a change of direction,
 * which `SNAP` correctly calls a saccade. One creature flicking while a hundred
 * and nineteen glide reads as a glitch.
 *
 * It was 40 and is checked rather than chosen: `check-watch.ts` scans every cell
 * on every frame against `SNAP`, and 40 tripped it at 1.75 once the row beat
 * moved `B_CARD` and the orbit arrived at the park on a different phase.
 *
 * The phase matters as much as the duration, which is worth knowing before
 * retuning either. Holding this at 48 and moving `B_CARD` by six frames either
 * way takes the worst swing from 1.70 to 1.38: the film is not near a cliff in
 * general, it was on one particular unlucky frame. 56 with `B_CARD` off that
 * frame measures 1.31, which is margin rather than a pass.
 */
const PARK = 56;

/** Where the card sits, and therefore where the film ends up looking. */
export const CARD_X = WIDTH / 2;
export const CARD_Y = HEIGHT / 2;

/**
 * The frame the cursor is first properly in shot, found rather than asserted.
 *
 * The gaze engages here and not at `ENTER`, because a blobatar tracking a
 * pointer that is still off the edge of the frame is a blobatar staring at
 * nothing. Scanned so that retuning the orbit or the radii moves this with
 * them, instead of leaving a hand-written number to go quietly wrong.
 */
export const ENGAGE = (() => {
  for (let f = ENTER; f < END; f++) if (cursorAt(f).x <= WIDTH - 40) return f;
  return ENTER;
})();

/**
 * The reaction: the field goes wide-eyed at the cookie, then settles.
 *
 * A burst rather than a latch, and that is a measurement rather than a
 * preference. `surprised` is the one pose in the library that *enlarges* the
 * pair, `esx 1.34` against every other pose reducing `esy`, so it is the only
 * candidate for big eyes. Rendered against a full excursion it also fights the
 * thing the film is about: a bigger eye makes the same translate a smaller
 * displacement relative to itself, and it starts closer to the silhouette where
 * there is less room to go. In the close shot at 459px the glance stopped
 * reading almost entirely. `expression.ts` predicts exactly this where it says
 * containment is the binding guard on this pose for the first time in the
 * feature, because growing and lifting the pair push its corners at the outline.
 *
 * So the big eyes go precisely where tracking is not the point. For thirty
 * frames after the cookie lands the shot is a reaction, and then it releases to
 * idle well before the camera settles, so the wide shot proper is back to the
 * excursion at full legibility. It also keeps the film off ending on a hundred
 * and twenty alarmed faces under the words, which reads as surveilled rather
 * than delightful, and that is the open question the whole layer is gated on.
 *
 * Six frames after the swap, for the same reason the swap is ten frames after
 * the camera: cause and then effect. Simultaneous reads as a cut.
 */
export const BURST = SWAP + 6;
const BURST_IN = 13;
const BURST_HOLD = 30;
const BURST_OUT = 20;

/** How far the field is into `surprised`, 0 to 1. */
export function burstAt(frame: number): number {
  const t = frame - BURST;
  if (t < 0) return 0;
  if (t < BURST_IN) return ease(t / BURST_IN);
  if (t < BURST_IN + BURST_HOLD) return 1;
  const out = (t - BURST_IN - BURST_HOLD) / BURST_OUT;
  return out >= 1 ? 0 : 1 - ease(out);
}

/** Whether the pose is moving on this frame, as opposed to held or absent. */
const morphing = (frame: number) => {
  const t = frame - BURST;
  return (
    (t >= 0 && t < BURST_IN) ||
    (t >= BURST_IN + BURST_HOLD && t < BURST_IN + BURST_HOLD + BURST_OUT)
  );
};

/**
 * The blink clock, which stops while the pose is moving.
 *
 * `seek.css` reads `--vid-blink-t` and falls back to the film clock, and the
 * expressions film sets it to a clock that stops during a pose change for a
 * reason that applies here word for word: a blink flattens both eyes, and the
 * middle of a morph is the one place that is not life but a glitch. With 120
 * creatures blinking out of phase, several are mid-blink on any given frame of
 * a 13-frame morph, so this is not a rare case.
 *
 * Accumulated rather than computed, because "how much time has been held back
 * by now" is a sum over the frames before this one and there is no closed form
 * that stays right when the beats move.
 */
const BLINK_MS = (() => {
  const out = new Float64Array(END);
  let held = 0;
  for (let f = 0; f < END; f++) {
    out[f] = ((f - held) / FPS) * 1000;
    if (morphing(f)) held++;
  }
  return out;
})();

export const blinkTimeAt = (frame: number) =>
  BLINK_MS[Math.min(Math.max(frame, 0), END - 1)]!;

/** How long the hand-over takes. The rove fades out as the pursuit fades in. */
const ENGAGE_OVER = 18;

/**
 * How far the idle glance has stood down for the gaze, 0 to 1.
 *
 * The two systems aim the same pair of eyes at different things, and with both
 * live the eyes read as unable to decide. `blobatar/gaze.css` damps the seeds by this,
 * so the rove is at full amplitude before the cursor arrives and gone once it
 * has, with the cross-fade in between rather than a switch.
 */
export const holdAt = (frame: number) =>
  smoothstep(clamp01((frame - ENGAGE) / ENGAGE_OVER));

/**
 * The pursuit's smoothing factor for one frame of this film.
 *
 * `SETTLE`, `SNAP` and `DEADZONE` are imported rather than restated, and the
 * whole pursuit below is the library's `step`. That is what makes the film the
 * shipped behaviour rather than a flattering imitation of it: there is no
 * second copy of the arithmetic here to drift away from the one on the page,
 * and retuning a constant in `blobatar/gaze` retunes the announce with it.
 *
 * Precomputed because this film's `dt` is a constant. Every frame is `1 / FPS`
 * apart by construction, where a browser driver measures the gap it actually
 * got.
 */
const K = pursuit(1000 / FPS, SETTLE);

export const COUNT = COLS * ROWS;

/**
 * Which cells the row beat owns, as grid indices.
 *
 * Derived from `SHOWCASE` rather than written out, so moving the beat to another
 * row is one constant and not nine.
 */
export const SHOWCASE_CELLS: ReadonlySet<number> = new Set(
  SHOWCASE.map((s) => s.row * COLS + s.col),
);

/**
 * Every cell's name: the showcase across the hero's row, the crowd everywhere
 * else.
 *
 * Built as one array rather than resolved per cell at render time, because the
 * crowd has to skip whatever the showcase has already claimed. The old code
 * indexed `CAST` by counting cells before the hero, which worked while the hero
 * was the only exception and silently shifts every name in the grid the moment
 * there are nine.
 */
export const GRID: readonly string[] = (() => {
  const byCell = new Map(SHOWCASE.map((s) => [s.row * COLS + s.col, s.name]));
  const out: string[] = [];
  let next = 0;
  for (let i = 0; i < COUNT; i++) out.push(byCell.get(i) ?? CAST[next++]!);
  return out;
})();

/** A cell's centre in grid coordinates. */
export const cellAt = (i: number) => ({
  x: (i % COLS) * CELL + CELL / 2,
  y: GRID_Y + Math.floor(i / COLS) * CELL + CELL / 2,
});

/**
 * The solved track: `[frame][cell]` as four interleaved numbers, the signed
 * direction and its two unsigned magnitudes.
 *
 * The magnitudes are carried rather than recovered with CSS `abs()` for the
 * reason `motionVars` gives about `--mo-look-m*`: how far a feature foreshortens
 * depends on how far the face turned and not on which way, and emitting both is
 * cheaper than depending on a function whose support is newer than the layer.
 */
const STRIDE = 4;
const track = new Float32Array(END * COUNT * STRIDE);

(() => {
  const x = new Float64Array(COUNT);
  const y = new Float64Array(COUNT);

  for (let f = 0; f < END; f++) {
    const cam = camera(f);
    const cursor = cursorAt(f);
    const engaged = holdAt(f);
    /* The drawn radius of one blobatar on this frame, which is what the
       deadzone is a fraction of. It shrinks by a factor of 3.7 during the pull
       back, so a fixed pixel radius would be wrong at one end or the other. */
    const radius = (BLOB * cam.scale) / 2;

    for (let i = 0; i < COUNT; i++) {
      const cell = cellAt(i);
      const cx = cam.x + (cell.x - HERO_X) * cam.scale;
      const cy = cam.y + (cell.y - HERO_Y) * cam.scale;
      /*
       * The library's pursuit, one frame at a time, with `engaged` as the gain
       * so the crowd hands its eyes over as the cursor arrives rather than
       * snapping to it. Everything the driver on the page wraps around this
       * (measuring a box, listening to a pointer, parking when nothing moves)
       * is what the film does not need and does not have: the centres come from
       * `camera`, the target comes from `cursorAt`, and the clock is the frame
       * number.
       */
      const { x: nx, y: ny } = step({
        x: x[i]!,
        y: y[i]!,
        dx: cursor.x - cx,
        dy: cursor.y - cy,
        radius,
        k: K,
        gain: engaged,
      });
      x[i] = nx;
      y[i] = ny;

      const at = (f * COUNT + i) * STRIDE;
      track[at] = nx;
      track[at + 1] = ny;
      track[at + 2] = Math.abs(nx);
      track[at + 3] = Math.abs(ny);
    }
  }
})();

/** One blobatar's gaze on one frame: signed direction, then the magnitudes. */
export function lookAt(frame: number, i: number): [number, number, number, number] {
  const f = Math.min(Math.max(frame, 0), END - 1);
  const at = (f * COUNT + i) * STRIDE;
  return [track[at]!, track[at + 1]!, track[at + 2]!, track[at + 3]!];
}

const ms = (f: number) => (f / FPS) * 1000;
export const seconds = ms(END) / 1000;

/**
 * Every name the film draws, **hero first**.
 *
 * The ordering is load-bearing rather than tidy: the close shot contains only
 * the hero, so `scripts/check-gaze.ts` bounds its excursion against that one
 * face and finds it at the head of this list.
 *
 * The measuring pass in `face.tsx` needs the whole roll up front, because it
 * runs once before the first frame rather than as cells mount. Derived from
 * `CAST` rather than written beside it, so a change to the cut set or to the
 * seed walk carries into the measurement instead of leaving a face unmeasured
 * and silently ungazing.
 */
export const ROLL: readonly string[] = [HERO, ...GRID.filter((n) => n !== HERO)];
