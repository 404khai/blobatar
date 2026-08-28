/**
 * The two things about the gaze film that need a browser to check.
 *
 * `check-watch.ts` proves the *solve*: that the cursor is in frame, that the
 * close shot is outside the deadzone, that nothing flicks. Every one of those
 * is arithmetic and runs in bun. None of them would have caught the failure
 * this script exists for.
 *
 * ## Why it exists
 *
 * The film once wrote `--mo-track-x`, `--mo-track-y`, `--mo-track-mx` and
 * `--mo-track-my` and expected `blobatar/gaze.css` to turn them into a
 * translate on `.mo-eyes`. Under §4.8 that rule is gone: the stylesheet reads
 * ten per-eye channels instead, and the two magnitudes never existed in the
 * shipped file at all. So the film kept rendering, every check kept passing,
 * and a hundred and twenty blobatars sat there perfectly drawn and completely
 * still. That is the layer's own documented failure mode, "the driver runs, the
 * properties are written, and the eyes do not move", arriving in the one place
 * with no driver to notice it.
 *
 * A channel contract cannot be checked without resolving it, and resolving it
 * needs a style engine. So this renders real frames and looks at what actually
 * moved.
 *
 * ## What it checks
 *
 * 1. **Every face is measured.** `face.tsx` leaves an unmeasurable name out of
 *    the cache rather than defaulting it, and a name that is not in there is a
 *    blobatar that renders correctly and never gazes.
 * 2. **The cast's turns are in the band the shot was tuned in.** The fitted
 *    head spans 0.98 of the box on `round` and 0.39 on `triangle`, and the turn
 *    is `travel / radius`, so one excursion is a very different angle across the
 *    roster. Too little and the wide shot is a field of creatures not moving;
 *    too much and they saturate at the limb and stop tracking.
 */

import { renderStill, selectComposition } from "@remotion/renderer";
import { bundle } from "@remotion/bundler";
import { alias } from "../alias";
import { ROLL, TRAVEL_CLOSE, TRAVEL_WIDE } from "../src/watch";

const fail = (msg: string) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

interface Report {
  count: number;
  missing: string[];
  bands: { shape: string; min: number; worst: string; max: number; n: number }[];
  /** The hero's own head, which is the only one in the close shot. */
  hero: { rx: number; ry: number };
}

const logs: string[] = [];

/* The same aliases the CLI applies from `remotion.config.ts`, which this path
   into the bundler never reads. Shared rather than restated: see `alias.ts`. */
const serveUrl = await bundle({
  entryPoint: new URL("../src/index.ts", import.meta.url).pathname,
  webpackOverride: (current) => ({
    ...current,
    resolve: { ...current.resolve, alias: { ...current.resolve?.alias, ...alias } },
  }),
});
const composition = await selectComposition({ serveUrl, id: "Gaze" });

/* One frame is enough for the geometry: the measuring pass runs once per tab,
   before anything is snapshotted, and reports the whole roll. */
await renderStill({
  composition,
  serveUrl,
  output: "/tmp/blobatar-check-gaze.png",
  frame: 300,
  /* Captured, not printed. The pass reports all 120 faces on one line, which
     is the check's input and nobody's idea of console output. */
  logLevel: "error",
  onBrowserLog: (l) => logs.push(l.text),
});

const line = logs.find((l) => l.includes("[faces] "));
if (!line) fail("the measuring pass never reported. Did `face.tsx` stop emitting `[faces]`?");

const report: Report = JSON.parse(line!.slice(line!.indexOf("[faces] ") + 8));

/* 1. Every face measured. */
if (report.missing.length) {
  fail(
    `${report.missing.length} of ${ROLL.length} faces were never measured, so ` +
      `they render without a gaze: ${report.missing.slice(0, 6).join(", ")}${
        report.missing.length > 6 ? ", …" : ""
      }`,
  );
}
if (report.count !== ROLL.length) {
  fail(`the pass measured ${report.count} faces but the film draws ${ROLL.length}`);
}

/*
 * 2. The turns, per shape.
 *
 * `travel / radius` in radians, on the narrower axis because that is the one
 * that saturates first.
 *
 * **The worst head in the band, not the average one.** The fit varies within a
 * shape as well as between shapes, the cast's capsules running from 8.5 units
 * tall to 12.9, and an average hides exactly the failure that matters: one
 * creature
 * in the field with its eyes parked at the limb, staring while everything
 * around it tracks. There is no such thing as an acceptable average there, so
 * the bound is taken on the worst.
 */
const deg = (r: number) => (r * 180) / Math.PI;

const rows = report.bands
  .map((b) => ({
    ...b,
    /* The smallest head in the band turns most, so it is the one that
       saturates first and the one the ceiling is taken on. */
    wide: deg(TRAVEL_WIDE / b.min),
  }))
  .sort((a, b) => b.n - a.n);

/*
 * The band each shot is tuned in, in degrees of turn.
 *
 * The floor is legibility. Below about 15° the turn is a glance rather than a
 * head, and the sphere cues the projection exists for (the foreshortening, the
 * per-eye differential, the convergence tilt) are all present and too small to
 * see. That is the state this film was in before it was retuned, and it looks
 * exactly like a film that does not have them.
 *
 * The ceiling is saturation. `project` caps the turn at the room the mark has
 * before the limb, so a large enough turn parks the leading eye at the edge
 * with almost no width left and it stops answering the pointer: the creature
 * reads as staring while the field around it tracks.
 *
 * **Two ceilings, because a turn is not the whole story: how big the face is
 * drawn matters as much.** A foreshortened eye on the 459px hero is still tens
 * of pixels wide; the same fraction of a 124px cell is a speck. So the close
 * shot, which is one large face, carries more turn than the field does.
 *
 * Every one of these is bounded by a render rather than derived. Close: 49°
 * ships and reads, 65° still reads, so the ceiling sits above both. Wide: 50°
 * ships and reads, 63° visibly pinches the small heads, 74° is unmistakably
 * broken. Move any of them by looking at a frame, not by reasoning about it.
 */
const MIN_DEG = 15;
const CLOSE_MAX = 70;
const WIDE_MAX = 55;

/*
 * The two shots are bounded by different things, which is the whole reason
 * these are two numbers rather than one.
 *
 * The close shot has exactly one head in it, the hero's, because the crowd
 * mounts twenty frames before the pull back and is not visible until it. So
 * nothing in the cast constrains `TRAVEL_CLOSE`, and bounding it by the whole
 * roster would fail the build over a creature that is not on screen.
 *
 * The wide shot has all hundred and twenty, and is bounded by the worst of
 * them.
 */
const heroTurn = deg(TRAVEL_CLOSE / Math.min(report.hero.rx, report.hero.ry));
if (heroTurn < MIN_DEG) {
  fail(
    `the hero turns only ${heroTurn.toFixed(0)}° in the close shot, under the ` +
      `${MIN_DEG}° legibility floor. Raise TRAVEL_CLOSE in src/watch.ts`,
  );
}
if (heroTurn > CLOSE_MAX) {
  fail(
    `the hero turns ${heroTurn.toFixed(0)}° in the close shot, past the ` +
      `${CLOSE_MAX}° saturation ceiling. Lower TRAVEL_CLOSE in src/watch.ts`,
  );
}

for (const r of rows) {
  if (r.wide > WIDE_MAX) {
    fail(
      `${r.shape} turns ${r.wide.toFixed(0)}° in the wide shot, past the ${WIDE_MAX}° ` +
        `saturation ceiling: ${r.worst} is fitted at only ${r.min.toFixed(1)} units, ` +
        `so its eyes park at the limb and stare while the field around them ` +
        `tracks. Lower TRAVEL_WIDE in src/watch.ts, or cut ${r.shape} in CUT`,
    );
  }
  if (r.wide < MIN_DEG) {
    fail(
      `${r.shape} turns only ${r.wide.toFixed(0)}° in the wide shot, under the ` +
        `${MIN_DEG}° legibility floor. Raise TRAVEL_WIDE in src/watch.ts`,
    );
  }
}

console.log(
  `✓ gaze geometry: ${report.count} faces measured, hero head ` +
    `${report.hero.rx.toFixed(1)}×${report.hero.ry.toFixed(1)} units, ` +
    `turning ${heroTurn.toFixed(0)}° in the close shot`,
);
for (const r of rows) {
  console.log(
    `    ${r.shape.padEnd(9)} ×${String(r.n).padStart(3)}  ` +
      `head ${r.min.toFixed(1).padStart(5)}–${r.max.toFixed(1).padEnd(5)} ` +
      `turn ${r.wide.toFixed(0).padStart(3)}° wide (worst ${r.worst})`,
  );
}