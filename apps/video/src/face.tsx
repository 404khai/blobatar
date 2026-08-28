/**
 * The film's half of the projection: measuring the faces, once, before the
 * first frame is snapshotted.
 *
 * ## Why this file exists at all
 *
 * `blobatar/gaze` splits into pure arithmetic and a browser driver, and
 * `watch.ts` explains at length why this film can only have the first half: the
 * pursuit is recursive, Remotion renders frames out of order across several
 * workers, and a driver integrating as it went would produce a different film
 * per worker.
 *
 * `project()` is on the pure side and needs no clock. What it needs instead is
 * geometry: where each eye rests as a fraction of the face's radius, and what
 * that radius is. That is not derivable from a name. It is the fitted
 * ellipsoid, found by bisection against the rendered silhouette, and it lands
 * anywhere from 0.98 of the box on `round` to 0.39 on `triangle`. So the film
 * has to measure, and the one thing it must not do is measure with its own copy
 * of the fit. `survey()` is exported from the library for exactly this, and a
 * second bisection here would keep rendering plausibly while the two quietly
 * disagreed about where the limb is.
 *
 * ## Why it is measured up front rather than per cell
 *
 * A cell could measure itself in a layout effect, and the crowd does not mount
 * until twenty frames before the pull back, so the measuring would be spread
 * across the film. That works and is worse in two ways: every cell needs its own
 * `delayRender` handle, and every cell renders once with an unmeasured face
 * before it re-renders with a real one. On the frame the crowd mounts that is
 * 119 blobatars rendering a wrong first commit.
 *
 * Measured here instead: one hidden rig, one handle, one pass. Afterwards every
 * cell's gaze is pure arithmetic on a cached `Face`, which is what lets `Cell`
 * stay a function of the frame with no state of its own.
 *
 * The geometry is a function of the *name* and nothing else. `getBBox` reports
 * the element's own user units and ignores every transform on it and above it,
 * so a face measures the same whatever size it is drawn at, whatever the camera
 * is doing, and whatever pose the burst has it in. That is what makes one pass
 * enough.
 */

import { useEffect, useMemo, useState, type FC, type ReactNode } from "react";
import { Blobatar } from "@blobatar/react";
import { project, survey, type Face } from "blobatar/gaze";
import { traits } from "blobatar";
import { layout } from "blobatar/blob";
import { continueRender, delayRender } from "remotion";

/**
 * The measured faces, keyed by name.
 *
 * Module-level rather than state, because a Remotion worker keeps the tree
 * mounted across the frames it renders and this is the same answer for all of
 * them. A worker that starts at frame 300 pays the pass once, exactly as one
 * that starts at frame 0 does.
 */
const CACHE = new Map<string, Face>();

/** Which silhouette a name draws, for the geometry report below. */
const shape = (name: string) => layout(traits(name)).shape;

/** Everything the projection needs, for one blobatar. */
export interface Faces {
  get: (name: string) => Face | undefined;
}

/**
 * The rig the faces are measured off.
 *
 * Off-screen rather than `display: none`, and that is load-bearing: a subtree
 * with no layout box has no `getBBox`, so `survey()` returns `null` for every
 * one of them and the film renders with no gaze at all. `opacity: 0` alone
 * would still paint; a large negative offset costs nothing and is never
 * composited into the frame.
 *
 * `animate="always"` because the markup the survey reads only exists on an
 * animated blobatar: it looks for `.mo-bob > g:not(.mo-eyes)` for the
 * silhouette and `.mo-eye` for the eyes, and a static blobatar emits neither.
 * The cells are `animate="always"` too, so this is the same markup rather than
 * a stand-in for it.
 *
 * Size is irrelevant to the result and is kept small on purpose. `getBBox` is
 * in viewBox units, so 40px measures identically to 459px and lays out faster.
 */
const Rig: FC<{ names: readonly string[] }> = ({ names }) => (
  <div
    aria-hidden
    style={{ position: "absolute", left: -99999, top: -99999, width: 0, height: 0 }}
  >
    {names.map((name) => (
      <div key={name} data-face={name}>
        <Blobatar name={name} animate="always" size={40} />
      </div>
    ))}
  </div>
);

/**
 * Measure every name once, then render the film.
 *
 * `delayRender` is what makes this safe rather than merely usual. Remotion
 * snapshots a frame once React has committed and every outstanding handle has
 * been continued, so holding one across the measuring pass means no frame is
 * ever captured with an unmeasured face. Without it the first frame each worker
 * renders would be the one frame in the film with no gaze in it, and which
 * frame that is would depend on how the work was split.
 *
 * The children are not rendered until the pass is done, which is the other half
 * of the same guarantee: a `Cell` never sees a missing `Face` and so never
 * needs a fallback for one.
 */
export const WithFaces: FC<{
  names: readonly string[];
  children: (faces: Faces) => ReactNode;
}> = ({ names, children }) => {
  const [ready, setReady] = useState(() => names.every((n) => CACHE.has(n)));

  useEffect(() => {
    if (ready) return;
    const handle = delayRender("measuring the cast's faces");
    for (const name of names) {
      if (CACHE.has(name)) continue;
      const el = document.querySelector<SVGSVGElement>(`[data-face="${CSS.escape(name)}"] svg`);
      const f = el && survey(el);
      /* A name that could not be measured is left out rather than defaulted.
         `faces.get` returning `undefined` is a face that does not gaze, which
         is the honest failure: a made-up radius would put its eyes somewhere
         confidently wrong. `scripts/check-gaze.ts` fails the build if the pass
         ever leaves one behind. */
      if (f) CACHE.set(name, f);
    }
    /*
     * The measured geometry, per silhouette, on one line.
     *
     * The fitted head is the one input to this film that cannot be derived
     * without a browser, and it is the input the excursion has to be tuned
     * against: the turn is `travel / radius`, so a roster whose fits span 34
     * units on a `round` face and 8.5 on a `capsule` turns by wildly different
     * angles at one travel. `scripts/check-gaze.ts` renders this frame, reads
     * this line back, and fails the build if a face went unmeasured or if the
     * cast's turns have drifted out of the band the shot was tuned in.
     *
     * Summarised here rather than dumped raw, because the renderer echoes
     * whatever the page logs and a hundred and twenty rows of JSON in every
     * render log is not a diagnostic anyone reads. Per shape with the worst
     * face named is the form that is useful to a human and sufficient for the
     * check: the fit is a property of the silhouette, and what the bound cares
     * about is the smallest head in each band.
     */
    const bands = new Map<string, { min: number; worst: string; max: number; n: number }>();
    for (const [name, f] of CACHE) {
      const r = Math.min(f.rx, f.ry);
      const s = shape(name);
      const b = bands.get(s) ?? { min: Infinity, worst: name, max: 0, n: 0 };
      bands.set(s, {
        min: Math.min(b.min, r),
        worst: r < b.min ? name : b.worst,
        max: Math.max(b.max, r),
        n: b.n + 1,
      });
    }
    console.info(
      `[faces] ${JSON.stringify({
        /* What did not measure, rather than what did: a name missing here is a
           blobatar that renders correctly and never gazes, and it is normally
           the empty list. */
        count: CACHE.size,
        missing: names.filter((n) => !CACHE.has(n)),
        /* The first name in the roll, which `watch.ts` guarantees is the
           hero. The close shot has only that one face in it, so it is bounded
           separately from the cast. */
        hero: (() => {
          const f = CACHE.get(names[0]!);
          return f ? { rx: +f.rx.toFixed(2), ry: +f.ry.toFixed(2) } : null;
        })(),
        bands: [...bands].map(([shape, b]) => ({ shape, ...b, min: +b.min.toFixed(2), max: +b.max.toFixed(2) })),
      })}`,
    );

    setReady(true);
    continueRender(handle);
  }, [names, ready]);

  const faces = useMemo<Faces>(() => ({ get: (name) => CACHE.get(name) }), []);

  if (!ready) return <Rig names={names} />;
  return <>{children(faces)}</>;
};

/**
 * One cell's gaze, as the ten custom properties `blobatar/gaze.css` reads.
 *
 * This is the driver's write loop with the clock and the DOM taken out of it:
 * the same `project()`, the same turn, the same conversion back into viewBox
 * units, per eye. The driver writes these onto `.mo-eyes` because it is trying
 * not to invalidate a subtree per frame; the film has no such budget and writes
 * them on the cell's wrapper, where they inherit down to both eyes.
 *
 * **The two sets are picked apart by `--mo-sel`, not by the order they are
 * written in.** `motion.css` derives that selector from `--mo-wrap`'s sign, so
 * set 1 belongs to the eye at `-1` and set 2 to the eye at `+1`. `survey()`
 * returns its marks in `querySelectorAll(".mo-eye")` order and the driver
 * indexes them the same way, so the film inherits that coupling exactly rather
 * than guessing at it, which is the point of taking the marks from the library
 * rather than deriving them here.
 *
 * `travel` is an arc in viewBox units, so the turn is that arc over the radius,
 * one per axis because the radii differ. An eye off the middle of the face
 * covers less than the full arc, and that is the per-eye differential rather
 * than a shortfall.
 */
export function gazeVars(
  face: Face,
  x: number,
  y: number,
  travel: number,
): Record<string, string> {
  const yaw = travel / face.rx;
  const pitch = travel / face.ry;
  const out: Record<string, string> = {};

  for (let i = 0; i < face.marks.length; i++) {
    const p = project(face.marks[i]!, x * yaw, y * pitch);
    const n = i + 1;
    /* Back into viewBox units from fractions of each radius, because that is
       what the stylesheet adds them to. */
    out[`--mo-gz-dx${n}`] = (p.dx * face.rx).toFixed(3);
    out[`--mo-gz-dy${n}`] = (p.dy * face.ry).toFixed(3);
    out[`--mo-gz-sx${n}`] = p.sx.toFixed(4);
    out[`--mo-gz-sy${n}`] = p.sy.toFixed(4);
    out[`--mo-gz-t${n}`] = p.t.toFixed(3);
  }
  return out;
}
