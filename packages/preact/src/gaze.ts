/**
 * `@blobatar/preact/gaze` — the pointer-driven gaze layer (§4.5), as a hook.
 *
 * `@blobatar/react/gaze`'s twin, deliberately: the two adapters are read side
 * by side, Preact's hooks are React's hooks, and a consumer moving between them
 * should find the same three members and the same semantics. The long-form
 * account of *why* the hook is shaped this way — a callback ref so the driver's
 * life follows the element's, a target queued until there is a driver to hand
 * it to, `travel` in its own effect so retuning the excursion does not rebuild
 * the filter and snap the eyes home — lives in that file and is not restated
 * here.
 *
 * Two things are this package's own.
 *
 * **The ref goes on `elementRef`, not `ref`.** Preact pulls `ref` out of a
 * vnode's props before a function component sees them, and gives it the
 * component's internal instance rather than a DOM node; `forwardRef` is
 * `preact/compat`'s, and importing compat here would put it in the graph of
 * every consumer, including the ones rendering a static list. So the adapter
 * carries `elementRef` and this hands it something to fill.
 *
 * **It is a subpath**, the same bargain the React entry makes: `blobatar/gaze`
 * is 1.2 kB, and importing `Blobatar` links none of it.
 *
 * ```tsx
 * import { Blobatar } from "@blobatar/preact";
 * import { useGaze } from "@blobatar/preact/gaze";
 * import "blobatar/motion.css";
 * import "blobatar/gaze.css";
 *
 * const { ref } = useGaze({ travel: 3, lookAt: "pointer" });
 * <Blobatar elementRef={ref} name={user.email} animate="always" size={200} />;
 * ```
 */

import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { gaze, type Gaze, type GazeOptions, type GazeTarget } from "blobatar/gaze";

export type { GazeTarget };

/**
 * The driver's tuning, plus where to look.
 *
 * `GazeOptions.target` is not forwarded under its own name. On the driver it is
 * construction-time sugar, and a construction-time option that looks
 * declarative is the classic hook trap — passing `target={point}` and watching
 * it do nothing on the second render. What this takes instead is `lookAt`,
 * applied whenever it changes, which is therefore the declarative thing it
 * looks like.
 */
export type UseGazeOptions = Pick<GazeOptions, "settle" | "snap"> & {
  /**
   * Where to look, declaratively — the same `GazeTarget` union the function
   * takes, re-applied whenever it changes rather than only on mount. A point is
   * compared by its coordinates rather than by identity, so an inline
   * `{ x, y }` re-aims when the numbers move and not merely because the object
   * is new.
   *
   * **Omitted and `null` are different.** Omitted means "I will aim this
   * myself", and the hook then never writes over what your `lookAt` calls asked
   * for; `null` is a target like any other, meaning look at nothing.
   *
   * Do not drive a caret through this. A target that changes on every keystroke
   * is a render per keystroke to say something the driver could have been told
   * directly; `lookAt` is the seam for that, and the two mix — the last thing
   * asked for wins, whichever asked.
   */
  lookAt?: GazeTarget;
  /**
   * The excursion, in viewBox units. Omit and the stylesheet owns it.
   *
   * This is what opts a blobatar into the layer at all: `--mo-track-travel` is
   * registered with an initial value of `0px`, so a page that loads
   * `blobatar/gaze.css` and sets the excursion nowhere has a driver running and
   * no eyes moving. The blobatar is 100 units across, so `3` is 3% of the face,
   * and about 1.5 to 4 reads well.
   *
   * **A rule on `.mo-eyes` beats this, not the other way round.** The property
   * is written inline on the element the ref is on and reaches the eyes by
   * inheritance, and a selector matching that group directly is a declaration
   * on the element itself, which always wins over an inherited value. Set one
   * or the other. CSS is the better route for a whole field of blobatars, since
   * the property inherits, and for anything responsive.
   */
  travel?: number;
};

export interface UseGazeResult {
  /**
   * Attach to the `<Blobatar>`'s `elementRef`. A callback ref, so the driver's
   * life follows the element's exactly — a conditionally rendered blobatar
   * detaches without anything in a dependency array changing.
   */
  ref: (node: SVGSVGElement | HTMLImageElement | null) => void;
  /**
   * Point the eyes at something: a point in client coordinates, an element,
   * `"pointer"`, `"rest"`, or `null` for nothing. See `GazeTarget`.
   *
   * **A blobatar looks at nothing until this is called**, `"pointer"`
   * included. Stable for the life of the component, so it is safe in a
   * dependency array, and calling it before the blobatar has mounted is a
   * queued request rather than a no-op.
   */
  lookAt: (t: GazeTarget) => void;
  /** Re-measure the box, for a host that moved it in a way no observer sees. */
  remeasure: () => void;
}

export function useGaze({
  settle,
  snap,
  travel,
  lookAt: declared,
}: UseGazeOptions = {}): UseGazeResult {
  /* State rather than a ref, which is what makes the callback ref work: a ref
     assignment does not re-render, so the effect below could never see the
     element arrive. */
  const [node, setNode] = useState<SVGSVGElement | HTMLImageElement | null>(null);
  const driver = useRef<Gaze | null>(null);
  /* The last target asked for, held so it survives both not having a driver yet
     and the driver being rebuilt when the tuning changes. */
  const target = useRef<GazeTarget>(null);

  useEffect(() => {
    /* A static blobatar is an `<img>`, and there is nothing in one to look
       with. The ref takes both because `animate` is the caller's to change. */
    if (!node || !(node instanceof SVGSVGElement)) return;
    const g = gaze(node, { settle, snap, target: target.current });
    driver.current = g;
    return () => {
      driver.current = null;
      g.stop();
    };
  }, [node, settle, snap]);

  /* Declared after the driver's effect on purpose: effects run in declaration
     order, so the driver exists by the time this writes the property, and the
     remeasure is what stops its write threshold being derived from the `0px`
     that was there a moment earlier. Separate from that effect rather than
     folded into it, which would be shorter and wrong — `travel` in the driver's
     dependency list would rebuild the driver, and a new driver starts with the
     eyes at centre. */
  useEffect(() => {
    if (!node || travel === undefined) return;
    node.style.setProperty("--mo-track-travel", `${travel}px`);
    driver.current?.remeasure();
    return () => {
      node.style.removeProperty("--mo-track-travel");
    };
  }, [node, travel]);

  const lookAt = useCallback((t: GazeTarget) => {
    target.current = t;
    driver.current?.lookAt(t);
  }, []);

  /* Keyed on a value rather than on the target itself, because a point is the
     one member of the union a caller writes inline and keying on identity would
     re-aim on every render for any reason at all. */
  const key =
    declared && typeof declared === "object" && "x" in declared
      ? `${declared.x},${declared.y}`
      : declared;

  useEffect(() => {
    if (declared !== undefined) lookAt(declared);
  }, [lookAt, key]);

  const remeasure = useCallback(() => {
    driver.current?.remeasure();
  }, []);

  return { ref: setNode, lookAt, remeasure };
}
