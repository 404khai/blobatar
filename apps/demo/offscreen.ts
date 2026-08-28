/**
 * Offscreen culling for the tuning grid, as two candidates rather than one.
 *
 * The gaze layer was never the expensive part. With gaze switched off, four
 * hundred blobatars on `animate="always"` already run at ~6fps, because seven
 * CSS animations per blobatar are seven animations the style engine ticks every
 * frame whether or not anybody can see them. Culling attacks that number
 * instead of the 10-20% gaze adds on top of it.
 *
 * This is also `animate.ts`'s ruling seen from the other side. That file gates
 * idle motion on hover because "ambient motion seen constantly is motion worth
 * removing", which is an argument about attention; the same gate turns out to be
 * the performance answer too, and `always` across a whole field is exactly the
 * case it declines to serve. What is below is what `always` would need to be
 * affordable at scale.
 *
 * ## Two candidates, because they trade differently
 *
 * **`auto`** is `content-visibility: auto` and no JavaScript at all. The browser
 * decides what is skipped, and skips style, layout and paint for it rather than
 * only the animations. Strictly more is saved, and nothing has to be observed,
 * scheduled or torn down.
 *
 * **`pause`** is this module: an `IntersectionObserver` marking cells and a
 * stylesheet pausing the animations inside them. More code and less saved, but
 * it is the one that is honest about *what* it turned off, and it composes with
 * a layout that cannot afford containment.
 *
 * ## What they are actually worth, measured
 *
 * Headless Chrome, software raster, 1440x900, 64px cells, n=200, `animate="hover"`,
 * so read the shape rather than the absolute values. "in grid" sweeps the pointer
 * across the cells; "over header" moves it without ever hovering a blobatar,
 * which separates the hover trail from the gaze writes.
 *
 *                        still   in grid   over header
 *   render, gaze off      18fps    18fps      19fps
 *   render, gaze near     21fps    14fps      15fps
 *   unhovered, gaze off   60fps    59fps      60fps
 *   unhovered, gaze near  60fps    31fps      43fps
 *
 * The first row is the finding. A page sitting perfectly still, with gaze
 * switched off and nothing being asked of it, runs at 18fps, because 2400
 * animations are ticking for a field nobody is pointing at. `unhovered` takes
 * that to 60 and the sweeping case from 14 to 31.
 *
 * The offscreen pair is a much smaller lever and only bites once the grid is
 * taller than the window: at 64px cells a 1440x900 viewport holds about two
 * hundred blobatars, so below that count there is nothing offscreen to cull and
 * both are worth exactly zero. Where there is something, at n=400, `pause` took
 * 6fps to 8 and `auto` measured level or slightly *worse* — its relevancy
 * tracking and containment are not free, and skipping paint is worth less with
 * no GPU to skip it on. That ranking may invert on real hardware, which is why
 * both stayed in as controls rather than one being deleted.
 *
 * ## What both of them cost, which is not nothing
 *
 * `idle.ts` opens by saying the whole idle layer is a pure function of time, and
 * that two blobatars agreeing about the clock agree about everything. **Pausing
 * breaks that.** A blobatar parked for three seconds comes back three seconds
 * behind its neighbours, so the field is no longer a function of the clock, it
 * is a function of the clock and of what has been on screen.
 *
 * Invisible here, and worth writing down anyway. The phases are seeded to look
 * uncorrelated in the first place, so drift only re-randomises something that
 * was already random, and nobody can see the difference in a grid. It would be a
 * real semantic change in the library, where that purity is what makes the
 * stylesheet and `idle.ts` two renderings of one thing, and any shipped version
 * of this owes an answer there rather than a shrug.
 */

/** The attribute the stylesheet reads. On the cell, not on anything React composes. */
const OFF = "data-off";

/**
 * `""` renders everything, which is the grid as it was.
 *
 * `auto` and `pause` are the two offscreen candidates. `unhovered` is a third
 * and much larger one that needs no JavaScript either: it is pure CSS in
 * `offscreen.css`, it subsumes the offscreen pair in `animate="hover"` — an
 * offscreen cell is never hovered — and it is the only one that reaches a page
 * sitting still.
 */
export type Cull = "" | "auto" | "pause" | "unhovered";

export interface Culler {
  /** Re-read the DOM after a render changed which cells exist. */
  rescan: () => void;
  stop: () => void;
}

/**
 * Mark cells that are offscreen so `offscreen.css` can pause what is inside them.
 *
 * **`rootMargin` was a full viewport and that culled precisely nothing.** A grid
 * of 400 cells at 64px is 1534px tall against a 900px viewport, so a 900px band
 * in each direction covers all of it, twice over: 400 cells observed, 0 marked,
 * and a measurement that showed culling making no difference whatsoever. The
 * margin is the whole experiment, and a generous one quietly turns it off.
 *
 * A quarter of a viewport is the compromise. It is still ~3.5 rows of lead time
 * at the default cell size, which is more scrolling than anybody does between
 * frames, and it leaves a 400-cell grid with something real to cull.
 */
export function cull(root: HTMLElement): Culler {
  let cells: Element[] = [];

  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) e.target.removeAttribute(OFF);
        else e.target.setAttribute(OFF, "");
      }
    },
    { rootMargin: "25%" },
  );

  const scan = () => {
    seen.disconnect();
    cells = [...root.querySelectorAll(".cell")];
    for (const c of cells) seen.observe(c);
  };

  scan();

  return {
    rescan: scan,
    stop: () => {
      seen.disconnect();
      for (const c of cells) c.removeAttribute(OFF);
      cells = [];
    },
  };
}
