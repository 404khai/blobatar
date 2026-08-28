/**
 * `useGaze` — the pointer-driven gaze layer (§4.5), as a hook.
 *
 * ## Why this is a subpath and not a prop on `<Blobatar>`
 *
 * A prop would put `blobatar/gaze` in this package's import graph for everyone.
 * The adapter is 76 B of its own code and the driver is 1.2 kB, so every
 * consumer rendering static avatars in a list would start paying for a pointer
 * driver they never run. That is the same trade the rest of the library makes
 * everywhere it can: expressions are values you import rather than strings you
 * pass, `motion.css` is a file you choose to load, and `gaze.css` is a second
 * one. `@blobatar/react-native/animated` is this exact shape already.
 *
 * The gate that keeps it honest is `@blobatar/react alone` in
 * `packages/harness/scripts/size.ts`, budgeted at 110 B. Importing this module
 * from `index.tsx` would blow it immediately, which is the point.
 *
 * A prop would also not have saved you anything. Two of the three steps stay
 * whatever the API looks like: `import "blobatar/gaze.css"`, and setting
 * `--mo-track-travel` on the blobatars that should follow the pointer, which is
 * what opts them in. A prop would have been the third of three while looking
 * like the only one, and the failure mode of getting it wrong is a face that
 * renders perfectly and never moves.
 *
 * ## What this actually removes
 *
 * The ref, the effect, the teardown, and the handle-in-a-ref that any caller
 * wanting `lookAt` has to keep. That last one is a trap rather than a chore:
 * the driver holds the eyes' current position, so rebuilding it to change where
 * it points snaps them to centre. A component that recreated it on each
 * keystroke would have eyes that jump between every pair of letters.
 *
 * ```tsx
 * import { Blobatar } from "@blobatar/react";
 * import { useGaze } from "@blobatar/react/gaze";
 * import "blobatar/motion.css";
 * import "blobatar/gaze.css";
 *
 * const { ref } = useGaze({ travel: 3 });
 * <Blobatar ref={ref} name={user.email} animate="always" size={200} />;
 * ```
 *
 * `travel` is the excursion, and it is what opts a blobatar in. Leave it out
 * and the stylesheet owns it instead, which is the better route for a whole
 * field of blobatars or for anything responsive:
 *
 * ```css
 * .hero .mo-eyes { --mo-track-travel: 3px; }
 * ```
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { gaze, type Gaze, type GazeOptions } from "blobatar/gaze";

/**
 * The driver's tuning, minus `at`.
 *
 * `GazeOptions.at` is deliberately not forwarded. On the driver it is
 * construction-time sugar for starting already aimed, and a construction-time
 * option that looks declarative is a trap in React: passing `at={point}` and
 * watching it do nothing on the second render is exactly the bug the shape
 * invites. `lookAt` is the seam for aiming, at every point in the component's
 * life including the first.
 */
export type UseGazeOptions = Pick<GazeOptions, "settle" | "snap"> & {
  /**
   * The excursion, in viewBox units. Omit and the stylesheet owns it.
   *
   * This is what opts a blobatar into the layer at all: `--mo-track-travel` is
   * registered with an initial value of `0px`, so a page that loads
   * `blobatar/gaze.css` and sets it nowhere has a driver running and no eyes
   * moving. That is the layer's likeliest failure, and its cause is a CSS
   * property rather than anything visible from here, which is the argument for
   * the option existing.
   *
   * **A rule on `.mo-eyes` beats this, not the other way round.** The hook
   * writes an inline custom property on the element you attach the ref to,
   * which is the `<svg>`, and the property reaches the eyes by inheriting down
   * to the `.mo-eyes` group that `gaze.css` reads it on. A selector matching
   * that group directly — `.something .mo-eyes { --mo-track-travel: … }` — is a
   * declaration on the element itself, and that always wins over an inherited
   * value however the ancestor's was written. Inline only outranks a selector
   * on the *same* element. So do not set both: the rule wins, `travel` does
   * nothing, and the symptom is a face that renders perfectly and never moves.
   * Setting it on an ancestor, or on the host the ref is on, is inheritance
   * against inheritance and the inline value wins there as expected.
   *
   * There is no default for the same reason: leave it out and the two can never
   * collide, because the hook writes nothing.
   *
   * CSS keeps three things this cannot do, so it is the better route whenever
   * one of them applies: setting the excursion on *many* blobatars from one
   * ancestor, since the property inherits; making it responsive through a media
   * or container query; and keeping the geometry beside the rest of a
   * component's geometry. The option is a convenience for the single-blobatar
   * case, not a replacement for the property.
   *
   * The scale: the blobatar is 100 units across, so `3` is 3% of the face, not
   * three screen pixels. The idle glance's widest stop is a median 1.4 units,
   * so the range worth trying is about 1.5 to 4, and the ceiling is the eyes
   * crossing the silhouette — which `motion.css` is explicit is allowed and
   * reads as a face turning on a round head.
   */
  travel?: number;
};

export interface UseGazeResult {
  /**
   * Attach to the `<Blobatar>`. A callback ref, not an object one.
   *
   * The driver's life then follows the element's exactly, which an object ref
   * cannot express: a blobatar that is conditionally rendered, or swapped for
   * something else, mounts and unmounts without anything in a dependency array
   * changing, so an effect keyed on options alone would hold a driver pointed
   * at a detached node. React calls this with the element and with `null`, so
   * there is nothing to key on and nothing to remember to key on.
   */
  ref: (node: SVGSVGElement | null) => void;
  /**
   * Watch a fixed point in client coordinates, or `null` to hand the eyes back
   * to the pointer.
   *
   * Stable for the life of the component, so it is safe in a dependency array
   * and safe to hand to a child. Calling it before the blobatar has mounted is
   * a no-op rather than an error.
   */
  lookAt: (p: { x: number; y: number } | null) => void;
  /**
   * Aim the eyes at the blobatar's own centre, which is how you say "stop
   * looking" without handing them back to the pointer.
   *
   * The driver's near-field ease takes the excursion to zero as a target
   * approaches the centre, because there is no direction to look in at
   * something you are already on. So this glides the eyes home over the same
   * curve everything else uses and holds them there, where `lookAt(null)` would
   * resume following the cursor and `stop()` would snap them.
   *
   * It lives here rather than on the driver because it needs the element's box,
   * and the hook is the layer that has it.
   */
  home: () => void;
  /**
   * Re-measure the box.
   *
   * Scroll, resize and the element's own resizes are already watched. This is
   * for a host that moved it some other way, or that knows the layout settled
   * before any observer will say so.
   */
  remeasure: () => void;
}

export function useGaze({ settle, snap, travel }: UseGazeOptions = {}): UseGazeResult {
  /*
   * State rather than a ref, and it is what makes the callback ref above work.
   * A ref assignment does not re-render, so an effect could never see the
   * element arrive; setting state does, and the effect below then runs with a
   * `node` that is either the mounted element or `null`. One extra render on
   * mount, which is the standard cost of measuring a node in React.
   */
  const [node, setNode] = useState<SVGSVGElement | null>(null);
  const driver = useRef<Gaze | null>(null);

  /*
   * `settle` and `snap` are primitives, so an inline `useGaze({ settle: 90 })`
   * does not rebuild the driver on every render the way an object identity in
   * this list would. Changing either does rebuild it, and that resets the eyes
   * to centre — correct, since a new time constant is a different filter and
   * carrying the old one's state into it would be neither.
   */
  useEffect(() => {
    if (!node) return;
    const g = gaze(node, { settle, snap });
    driver.current = g;
    return () => {
      driver.current = null;
      g.stop();
    };
  }, [node, settle, snap]);

  /*
   * Declared after the driver's effect on purpose. Effects run in declaration
   * order, so on mount the driver exists by the time this writes the property,
   * and the `remeasure` below is what stops the threshold being derived from
   * the `0px` that was there a moment earlier.
   *
   * Separate from that effect rather than folded into it, which would be
   * shorter and wrong: `travel` in the driver's dependency list would rebuild
   * the driver whenever it changed, and a new driver starts with the eyes at
   * centre. Changing how far a blobatar looks should not make it stop looking.
   *
   * The cleanup removes the property rather than restoring a previous value.
   * There is nothing to restore: the hook only ever wrote it if `travel` was
   * given, so removing it hands the element back to whatever the stylesheet
   * says, which is exactly where it would have been.
   */
  useEffect(() => {
    if (!node || travel === undefined) return;
    node.style.setProperty("--mo-track-travel", `${travel}px`);
    /* The excursion itself is pure CSS and applies on the next frame. This is
       for the driver's write threshold, which is derived from the value and
       cached at measure time, so without it a change leaves writes stopping
       slightly early or late until the next scroll or resize. */
    driver.current?.remeasure();
    return () => {
      /* A block, not a concise body: `removeProperty` returns the old value,
         and a cleanup that returns a string is not a `Destructor`. */
      node.style.removeProperty("--mo-track-travel");
    };
  }, [node, travel]);

  const lookAt = useCallback((p: { x: number; y: number } | null) => {
    driver.current?.lookAt(p);
  }, []);

  const remeasure = useCallback(() => {
    driver.current?.remeasure();
  }, []);

  const home = useCallback(() => {
    if (!node) return;
    const r = node.getBoundingClientRect();
    driver.current?.lookAt({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }, [node]);

  return { ref: setNode, lookAt, home, remeasure };
}
