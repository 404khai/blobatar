/**
 * `@blobatar/solid/gaze` — the pointer-driven gaze layer (§4.5), as a ref.
 *
 * ## Why this is one object rather than the React hook's three members
 *
 * Because Solid does not re-render. The React hook exists to survive renders:
 * its `ref` is a callback so the driver's life follows the element's, its
 * `lookAt` is stable so it can sit in a dependency array, and its declared
 * target is re-applied on every change because a component re-running is the
 * only moment it has to notice one. None of that is a question here. A
 * component body runs once, so `const eyes = createGaze({ travel: 3 })` runs
 * once and plainly holds one driver.
 *
 * So the whole thing is the ref: a function with the driver's two seams hung
 * off it, which a function can carry because it is an object.
 *
 * ```tsx
 * import { Blobatar } from "@blobatar/solid";
 * import { createGaze } from "@blobatar/solid/gaze";
 * import "blobatar/motion.css";
 * import "blobatar/gaze.css";
 *
 * const eyes = createGaze({ travel: 3, target: "pointer" });
 * <Blobatar ref={eyes} name={user.email} animate="always" size={200} />;
 * ```
 *
 * `ref={eyes}` reaches the element with no change to the adapter: a `ref` on a
 * Solid component is an ordinary prop, and `<Blobatar>` already spreads what it
 * does not read onto the element it renders, where Solid's own `spread` calls
 * it with the node.
 *
 * ## Everything in the options is read once
 *
 * `target` keeps the driver's name for the driver's construction-time option,
 * rather than being renamed to `lookAt` as it is in React — there, a name that
 * looked declarative and applied only on mount would be a trap; here nothing
 * re-runs to make it one. Aiming that changes goes through `lookAt`, inside an
 * effect of your own if it follows a signal:
 *
 * ```tsx
 * createEffect(() => eyes.lookAt(watching() ? "pointer" : "rest"));
 * ```
 *
 * A subpath rather than a prop, the same bargain `@blobatar/react/gaze` makes:
 * the driver is 1.2 kB and importing `Blobatar` links none of it.
 */

import { onCleanup } from "solid-js";
import { gaze, type Gaze, type GazeOptions, type GazeTarget } from "blobatar/gaze";

export type { GazeTarget };

/**
 * The driver's tuning, plus where it starts out looking. `settle`, `snap` and
 * `target` are the driver's own and are spelled its way: this builds one driver
 * per element and hands them over unchanged, so renaming any of them would be
 * the adapter inventing a second vocabulary for something a caller can already
 * read about in `blobatar/gaze`.
 */
export interface CreateGazeOptions extends Pick<GazeOptions, "settle" | "snap" | "target"> {
  /**
   * The excursion, in viewBox units. Omit and the stylesheet owns it.
   *
   * This is what opts a blobatar into the layer at all: `--mo-track-travel` is
   * registered with an initial value of `0px`, so a page that loads
   * `blobatar/gaze.css` and sets the excursion nowhere has a driver running and
   * no eyes moving. The blobatar is 100 units across, so `3` is 3% of the face,
   * and about 1.5 to 4 reads well.
   *
   * **A rule on `.mo-eyes` beats this, not the other way round.** It is written
   * inline on the `<svg>` and reaches the eyes by inheritance, and a selector
   * matching that group directly is a declaration on the element itself, which
   * always wins over an inherited value. Set one or the other. CSS is the
   * better route for a whole field of blobatars, since the property inherits,
   * and for anything responsive.
   */
  travel?: number;
}

/** A running gaze: the ref to hand `<Blobatar>`, carrying the driver's seams. */
export interface GazeRef {
  (el: SVGSVGElement | HTMLImageElement): void;
  /**
   * Point the eyes at something: a point in client coordinates, an element,
   * `"pointer"`, `"rest"`, or `null` for nothing. See `GazeTarget`.
   *
   * The last thing asked for wins, whoever asked, so a component can declare
   * its usual `target` and still aim by hand in between — and a caret can be
   * driven straight through here. Calling it before the blobatar has mounted is
   * a queued request rather than a no-op.
   */
  lookAt(target: GazeTarget): void;
  /** Re-measure the box, for a host that moved it in a way no observer sees. */
  remeasure(): void;
}

export function createGaze(options: CreateGazeOptions = {}): GazeRef {
  const { settle, snap, travel, target = null } = options;

  /** The last thing asked for, held so it survives not having a driver yet. */
  let aimed = target;
  /** The running driver, or `null` before mount and after cleanup. */
  let driver: Gaze | null = null;

  const ref = ((el: SVGSVGElement | HTMLImageElement) => {
    /* A static blobatar is an `<img>`, and there is nothing in one to look
       with: no `.mo-eyes`, no stylesheet reaching inside, no eyes. The ref
       takes both because `animate` is the caller's to change, and attaching to
       the `<img>` would leave a driver running a frame loop for a picture that
       cannot move. */
    if (!(el instanceof SVGSVGElement)) return;

    /* Written before the driver is built, which is the ordering that needs no
       `remeasure` afterwards: the driver reads the excursion when it measures,
       and it measures on construction. */
    if (travel !== undefined) el.style.setProperty("--mo-track-travel", `${travel}px`);

    const g = gaze(el, { settle, snap, target: aimed });
    driver = g;

    /* Registered here rather than in the function body, and it is the owner
       that makes the difference: a ref runs inside the render effect Solid
       created for it, so this is tied to the element's own life. A cleanup
       registered where `createGaze` was called would be tied to whatever owner
       happened to be current there, which for a gaze built outside a component
       is none at all. */
    onCleanup(() => {
      if (driver === g) driver = null;
      g.stop();
      /* Removed rather than restored: nothing was overwritten, so this hands
         the element back to the stylesheet, which is where it would have
         been. */
      if (travel !== undefined) el.style.removeProperty("--mo-track-travel");
    });
  }) as GazeRef;

  ref.lookAt = (t: GazeTarget) => {
    aimed = t;
    driver?.lookAt(t);
  };

  ref.remeasure = () => {
    driver?.remeasure();
  };

  return ref;
}
