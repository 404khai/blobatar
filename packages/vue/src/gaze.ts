/**
 * `@blobatar/vue/gaze` — the pointer-driven gaze layer (§4.5), as a composable.
 *
 * ## Why it takes the ref rather than handing one back
 *
 * Because in Vue the caller already owns it. A template ref is declared in the
 * `<script setup>` block and named in the template, and there is no callback
 * form for a composable to return the way React's hook does — so the honest
 * shape is the one Vue's own composables have: you pass what you already have,
 * and you get back the seams.
 *
 * What the ref holds is a *component* instance rather than an element, since
 * `<Blobatar>` is a component. `$el` is the element it rendered, and this reads
 * it for you — so the same call works whether the ref was put on the component
 * or on an `<svg>` of your own.
 *
 * ```vue
 * <script setup>
 * import { ref } from "vue";
 * import { Blobatar } from "@blobatar/vue";
 * import { useGaze } from "@blobatar/vue/gaze";
 * import "blobatar/motion.css";
 * import "blobatar/gaze.css";
 *
 * const blob = ref();
 * useGaze(blob, { travel: 3, target: "pointer" });
 * </script>
 *
 * <template>
 *   <Blobatar ref="blob" name="alain@example.com" animate="always" :size="200" />
 * </template>
 * ```
 *
 * ## Everything in the options is read once
 *
 * `target` keeps the driver's name for the driver's construction-time option,
 * rather than being renamed to `lookAt` as it is in React — there, a name that
 * looked declarative and applied only on mount would be a trap in a component
 * that re-renders for any reason; here the driver is built when the element
 * arrives and not again. Aiming that changes goes through `lookAt`, inside a
 * watcher of your own if it follows state:
 *
 * ```ts
 * const { lookAt } = useGaze(blob, { travel: 3 });
 * watchEffect(() => lookAt(watching.value ? "pointer" : "rest"));
 * ```
 *
 * A subpath rather than a prop, the same bargain `@blobatar/react/gaze` makes:
 * the driver is 1.2 kB and importing `Blobatar` links none of it.
 */

import { onScopeDispose, watch, type Ref } from "vue";
import { gaze, type Gaze, type GazeOptions, type GazeTarget } from "blobatar/gaze";

export type { GazeTarget };

/**
 * The driver's tuning, plus where it starts out looking. `settle`, `snap` and
 * `target` are the driver's own and are spelled its way: this builds one driver
 * per element and hands them over unchanged, so renaming any of them would be
 * the adapter inventing a second vocabulary for something a caller can already
 * read about in `blobatar/gaze`.
 */
export interface UseGazeOptions extends Pick<GazeOptions, "settle" | "snap" | "target"> {
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

/** A running gaze: the driver's two seams, for a ref the caller owns. */
export interface UseGazeResult {
  /**
   * Point the eyes at something: a point in client coordinates, an element,
   * `"pointer"`, `"rest"`, or `null` for nothing. See `GazeTarget`.
   *
   * The last thing asked for wins, whoever asked, so a component can declare
   * its usual `target` and still aim by hand in between — and a caret can be
   * driven straight through here. Calling it before the blobatar has mounted is
   * a queued request rather than a no-op.
   */
  lookAt: (target: GazeTarget) => void;
  /** Re-measure the box, for a host that moved it in a way no observer sees. */
  remeasure: () => void;
}

/** What a template ref holds: the component's instance, or an element. */
type Held = { $el?: unknown } | Element | null | undefined;

export function useGaze(el: Ref<Held>, options: UseGazeOptions = {}): UseGazeResult {
  const { settle, snap, travel, target = null } = options;

  /** The last thing asked for, held so it survives not having a driver yet. */
  let aimed = target;
  /** The running driver, or `null` before mount and after teardown. */
  let driver: Gaze | null = null;
  /** The element the excursion was written on, so it can be taken off again. */
  let written: SVGSVGElement | null = null;

  const stop = () => {
    driver?.stop();
    driver = null;
    /* Removed rather than restored: nothing was overwritten, so this hands the
       element back to the stylesheet, which is where it would have been. */
    written?.style.removeProperty("--mo-track-travel");
    written = null;
  };

  /*
   * `flush: "post"` and not the default, which is the one thing about this that
   * is Vue rather than the layer. Template refs are assigned as part of the
   * mount, and a pre-flush watcher runs before the DOM it is watching for
   * exists — so with the default the first thing this would measure is nothing
   * at all. `immediate` covers the ref that was already filled when the
   * composable ran, which is what happens when a blobatar is `v-if`'d back in.
   */
  watch(
    el,
    (held) => {
      stop();

      /* A component instance holds its element on `$el`; an element is already
         one. Written as a check on the property rather than on the shape of the
         thing, because an instance and an element are both objects and only one
         of them answers to this. */
      const node =
        held && typeof held === "object" && "$el" in held ? (held as { $el: unknown }).$el : held;

      /* A static blobatar is an `<img>`, and there is nothing in one to look
         with: no `.mo-eyes`, no stylesheet reaching inside, no eyes. `animate`
         is the caller's to change, so this is a mode rather than a mistake. */
      if (!(node instanceof SVGSVGElement)) return;

      /* Written before the driver is built, which is the ordering that needs no
         `remeasure` afterwards: the driver reads the excursion when it
         measures, and it measures on construction. */
      if (travel !== undefined) {
        node.style.setProperty("--mo-track-travel", `${travel}px`);
        written = node;
      }

      driver = gaze(node, { settle, snap, target: aimed });
    },
    { immediate: true, flush: "post" },
  );

  /* The scope rather than `onUnmounted`, so this also works in a composable
     called from an effect scope of the caller's own — and so a `useGaze` in a
     component still tears down with it, since a component *is* a scope. */
  onScopeDispose(stop);

  return {
    lookAt: (t) => {
      aimed = t;
      driver?.lookAt(t);
    },
    remeasure: () => driver?.remeasure(),
  };
}
