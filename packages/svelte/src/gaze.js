/**
 * `@blobatar/svelte/gaze` — the pointer-driven gaze layer (§4.5), as an
 * attachment.
 *
 * ## Why an attachment, when the other adapters hand back a ref
 *
 * Because a ref is not something this adapter can hand back. Svelte's two ways
 * of reaching an element from outside the component that renders it are
 * `bind:this` and `use:`, and neither crosses a component boundary: the first
 * yields the component's exports rather than its DOM, and an action can only be
 * written on the element it applies to. So the pattern every other binding
 * shares — take the element, start the driver on it — had no spelling here, and
 * a Svelte consumer who wanted the gaze had to stop using `<Blobatar>`.
 *
 * `{@attach …}` on a component is a prop under a symbol key, and
 * `Blobatar.svelte` already spreads `{...rest}` onto the element it renders, so
 * this reaches the `<svg>` without the component knowing the file exists. That
 * is why nothing was added to the component: the seam was already there,
 * carrying the caller's `class` and `aria-*`, and an attachment travels it.
 *
 * Attachments arrived in Svelte 5.29. The package still peers `svelte: ">=5"`,
 * because a range is per package rather than per subpath and narrowing it would
 * refuse installs for consumers of `Blobatar` alone, who need nothing of the
 * kind. A 5.0 consumer importing this gets an unresolved `svelte/attachments`,
 * which names the problem.
 *
 * A subpath rather than a prop, which is the bargain `@blobatar/react/gaze` and
 * `@blobatar/react-native/animated` already make: the driver is 1.2 kB, and a
 * consumer rendering static avatars in a list should not carry it. Here the
 * consumer's own bundler settles it rather than this package's build, since
 * what ships is source and `index.js` names nothing in this file.
 *
 * ## Everything in the options is read once
 *
 * The opposite of the React hook, which re-applies a declared `lookAt` on every
 * change — and the difference is the framework rather than a disagreement about
 * the layer. A hook re-runs on render and has to decide what a re-render means;
 * `const eyes = gaze(…)` in a `<script>` block runs once and plainly holds one
 * driver's tuning. So `target` keeps the driver's own name for the driver's own
 * construction-time option, and aiming that changes is `lookAt`, wrapped in the
 * consumer's own effect where their state is:
 *
 * ```svelte
 * const eyes = gaze({ travel: 3 });
 * $effect(() => eyes.lookAt(watching ? "pointer" : "rest"));
 *
 * <Blobatar {@attach eyes} name="alain@example.com" animate="always" size={200} />
 * ```
 *
 * Hold the result in a `const`. Writing `{@attach gaze({ travel })}` inline
 * works, but the expression re-runs whenever the state it reads changes, and a
 * rebuilt driver starts with the eyes at centre — so the face would snap home
 * every time the thing it was reading moved.
 */

import { gaze as start } from "blobatar/gaze";

/**
 * A gaze: an attachment with the driver's own seams hung off it.
 *
 * One object rather than the hook's three, because a function is an object and
 * `{@attach eyes}` beside `eyes.lookAt(p)` reads as one thing being aimed,
 * which it is. Nothing to destructure and nothing to keep in step.
 *
 * @param {import("./gaze").SvelteGazeOptions} [options]
 * @returns {import("./gaze").GazeAttachment}
 */
export function gaze(options = {}) {
  const { settle, snap, travel, target = null } = options;

  /**
   * The last thing asked for, held so it survives both not having a driver yet
   * and having a different one later. Aiming before the blobatar mounts is a
   * queued request rather than a no-op, which is what makes the effect above
   * work: it runs before the element exists, and Svelte will not run it again.
   */
  let aimed = target;

  /** The running driver, or `null` between mounts. */
  let driver = null;

  /** @type {import("./gaze").GazeAttachment} */
  const attach = (node) => {
    /*
     * A static blobatar is an `<img>`, and there is nothing in one to look
     * with: no `.mo-eyes`, no stylesheet reaching inside, no eyes. Attaching
     * anyway would leave a driver measuring a box and running a frame loop for
     * a picture that cannot move.
     */
    if (node.tagName !== "svg") return;

    /*
     * The excursion goes on the root `<g>`, and both halves of that are forced.
     *
     * Not the `<svg>`, which is where the React hook writes it: Svelte renders
     * `style={styleStr}` there and writes it as one attribute, so any prop
     * change — a new `name`, a new `hue` — replaces the whole declaration and
     * takes an inline property written from here with it.
     *
     * Not `.mo-eyes` either, which was the first fix and was worse for being
     * subtler. The eyes arrive inside `parts.inner`, which reaches the DOM
     * through `{@html}` as one opaque string, so a prop change does not edit
     * that element — it replaces it, and the property goes with the node it was
     * written on. The old element keeps reporting the value it was given, which
     * is why this needed a browser and a re-query to see at all.
     *
     * The root `<g>` is the one element in between that Svelte owns as an
     * element and never writes a `style` on: `{@html}` swaps its children, its
     * `class` is the only attribute that updates, and it is an ancestor of
     * whatever `.mo-eyes` currently is. The property inherits from there, which
     * also puts this back where the React hook has it — a rule matching the
     * eyes directly still wins.
     *
     * Written before the driver is built, which is the ordering that needs no
     * `remeasure` afterwards: the driver reads the excursion when it measures,
     * and it measures on construction.
     */
    const root = node.querySelector("g.mo-root") ?? node;
    if (travel !== undefined) root.style.setProperty("--mo-track-travel", `${travel}px`);

    const g = start(node, { settle, snap, target: aimed });
    driver = g;

    return () => {
      /*
       * Guarded rather than assigned, because teardown is not reliably last:
       * swapping the blobatar for another can attach the new element before
       * detaching the old, and clearing `driver` unconditionally would drop the
       * live one. Every later `lookAt` would go nowhere with the eyes still
       * moving on their idle loop, which is the failure that looks like nothing
       * being wrong.
       */
      if (driver === g) driver = null;
      g.stop();
      /* Removed rather than restored: nothing was overwritten, so this hands
         the element back to the stylesheet, which is where it would have been. */
      if (travel !== undefined) root.style.removeProperty("--mo-track-travel");
    };
  };

  /**
   * Point the eyes at something. The last thing asked for wins, whoever asked,
   * so a component can declare its usual `target` and still aim by hand in
   * between — and a caret can be driven straight through here with no render
   * per keystroke.
   */
  attach.lookAt = (t) => {
    aimed = t;
    if (driver) driver.lookAt(t);
  };

  /** Re-measure the box, for a host that moved it in a way no observer sees. */
  attach.remeasure = () => {
    if (driver) driver.remeasure();
  };

  return attach;
}
