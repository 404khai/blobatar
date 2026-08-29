import type { Attachment } from "svelte/attachments";
import type { GazeOptions, GazeTarget } from "blobatar/gaze";

export type { GazeTarget };

/**
 * The driver's tuning, plus where it starts out looking.
 *
 * `settle`, `snap` and `target` are the driver's own, spelled its way: this
 * binding builds one driver per mount and hands them over unchanged, so
 * renaming any of them would be the adapter inventing a second vocabulary for
 * something a caller can already read about in `blobatar/gaze`.
 */
export interface SvelteGazeOptions extends Pick<GazeOptions, "settle" | "snap" | "target"> {
  /**
   * The excursion, in viewBox units. Omit it and the stylesheet owns it.
   *
   * This is what opts a blobatar into the layer at all: `--mo-track-travel` is
   * registered with an initial value of `0px`, so a page that loads
   * `blobatar/gaze.css` and sets the excursion nowhere has a driver running and
   * no eyes moving.
   *
   * The blobatar is 100 units across, so `3` is 3% of the face rather than
   * three screen pixels, and about 1.5 to 4 reads well.
   *
   * **This beats a rule on `.mo-eyes`, which is the opposite of what the React
   * hook does.** There it is written on the `<svg>` and inherits down, so a
   * selector matching the eyes directly wins. Here it is written on `.mo-eyes`
   * itself, because Svelte rewrites the `<svg>`'s whole `style` attribute
   * whenever a prop changes and would take the property with it — so an inline
   * declaration on the element the stylesheet reads outranks every rule. Set
   * one or the other either way.
   *
   * CSS is still the better route for a whole field of blobatars, since the
   * property inherits, and for anything responsive.
   */
  travel?: number;
}

/**
 * A running gaze: an attachment to put on a `<Blobatar>`, carrying the two
 * seams the driver has.
 *
 * Typed against `Element` rather than `SVGSVGElement` because a blobatar with
 * `animate` off renders an `<img>`, and an attachment that could not be written
 * on both would make toggling animation a type error rather than the thing it
 * is: a blobatar with nothing to look with, which this is inert on.
 */
export interface GazeAttachment extends Attachment<Element> {
  /**
   * Point the eyes at something: a point in client coordinates, an element,
   * `"pointer"` for the cursor, `"rest"` to park them in the middle without
   * handing the idle glance back, or `null` for nothing, which does hand it
   * back. See `GazeTarget`.
   *
   * Calling it before the blobatar has mounted is a queued request rather than
   * a no-op: the target is remembered and handed to the driver the moment there
   * is one.
   */
  lookAt(target: GazeTarget): void;
  /**
   * Re-measure the box. Scroll, resize and the element's own resizes are
   * already watched; this is for a host that moved it some other way.
   */
  remeasure(): void;
}

/**
 * Start a gaze. The result is stable, so hold it in a `const` and attach it —
 * `{@attach eyes}` — rather than calling this inline in the template, where the
 * expression would re-run whenever the state it reads changes and rebuild the
 * driver with the eyes back at centre.
 */
export function gaze(options?: SvelteGazeOptions): GazeAttachment;
