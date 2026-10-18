/**
 * `@blobatar/angular/gaze` — the pointer-driven gaze layer (§4.5), as a
 * directive.
 *
 * `@blobatar/react/gaze`'s `useGaze`, re-expressed: the same tuning, the same
 * declarative target, the same imperative `lookAt` and `remeasure`. The long
 * account of why it is shaped this way lives in that file.
 *
 * **It is a subpath**, the same bargain every adapter makes: `blobatar/gaze` is
 * 1.2 kB, and importing `Blobatar` links none of it.
 *
 * Import `Blobatar` from `@blobatar/angular` and `BlobatarGaze` from here, and
 * load `blobatar/motion.css` and `blobatar/gaze.css` in the global stylesheet.
 * (Written as prose, not as import lines: ng-packagr keeps comments, and
 * `packages/harness` reads anything shaped like an import line in the bundle
 * as one.)
 *
 * ```ts
 * @Component({
 *   imports: [Blobatar, BlobatarGaze],
 *   template: `<blobatar [name]="user.email" animate="always" gaze="pointer" [gazeTravel]="3" />`,
 * })
 * ```
 *
 * Or aim it yourself, through the exported instance:
 *
 * ```html
 * <blobatar name="ori" animate="always" gaze #g="blobatarGaze" />
 * <input (focus)="g.lookAt($event.target)" (blur)="g.lookAt('rest')" />
 * ```
 */

import { Directive, PLATFORM_ID, effect, inject, input } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { gaze, type Gaze, type GazeTarget } from "blobatar/gaze";
import { Blobatar } from "@blobatar/angular";

export type { GazeTarget };

@Directive({
  selector: "blobatar[gaze]",
  standalone: true,
  exportAs: "blobatarGaze",
})
export class BlobatarGaze {
  private readonly host = inject(Blobatar);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private driver: Gaze | null = null;
  /* The last target asked for, held so it survives both not having a driver
     yet and the driver being rebuilt when the tuning changes. */
  private target: GazeTarget = null;

  /**
   * Where to look, declaratively: a point in client coordinates, an element,
   * `"pointer"`, `"rest"`, or `null` for nothing. Re-applied whenever it
   * changes.
   *
   * **A bare `gaze` attribute and `null` are different.** Bare means "I will
   * aim this myself" through `lookAt`, and the directive then never writes over
   * what those calls asked for; `null` is a target like any other, meaning look
   * at nothing. A blobatar looks at nothing until it is aimed, `"pointer"`
   * included.
   */
  readonly gaze = input<GazeTarget | "" | undefined>(undefined);

  /**
   * The excursion, in viewBox units. Omit and the stylesheet owns it.
   *
   * `--mo-track-travel` is registered at `0px`, so a page that loads
   * `blobatar/gaze.css` and sets the excursion nowhere has a driver running and
   * no eyes moving. About 1.5 to 4 reads well.
   */
  readonly gazeTravel = input<number | undefined>(undefined);
  /** Pursuit time constant in ms. */
  readonly gazeSettle = input<number | undefined>(undefined);
  /** Saccade threshold in units of the excursion. */
  readonly gazeSnap = input<number | undefined>(undefined);

  constructor() {
    /* The driver follows the `<svg>`: a static blobatar is an `<img>`, with
       nothing in it to look with, and `animate` is the caller's to toggle. */
    effect((onCleanup) => {
      const svg = this.host.svg()?.nativeElement;
      if (!this.browser || !svg) return;
      const g = gaze(svg, {
        settle: this.gazeSettle(),
        snap: this.gazeSnap(),
        target: this.target,
      });
      this.driver = g;
      onCleanup(() => {
        this.driver = null;
        g.stop();
      });
    });

    /* Separate from the driver's effect, deliberately: `travel` among the
       driver's dependencies would rebuild it, and a new driver starts with the
       eyes at centre. */
    effect((onCleanup) => {
      const svg = this.host.svg()?.nativeElement;
      const travel = this.gazeTravel();
      if (!this.browser || !svg || travel === undefined) return;
      svg.style.setProperty("--mo-track-travel", `${travel}px`);
      this.driver?.remeasure();
      onCleanup(() => svg.style.removeProperty("--mo-track-travel"));
    });

    effect(() => {
      const declared = this.gaze();
      if (declared !== undefined && declared !== "") this.lookAt(declared);
    });
  }

  /**
   * Point the eyes at something. Calling it before the blobatar has an `<svg>`
   * is a queued request rather than a no-op.
   */
  lookAt(t: GazeTarget): void {
    this.target = t;
    this.driver?.lookAt(t);
  }

  /** Re-measure the box, for a host that moved it in a way no observer sees. */
  remeasure(): void {
    this.driver?.remeasure();
  }
}
