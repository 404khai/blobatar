import { useMemo } from "react";
import { Blobatar } from "@blobatar/react";
import { NAMES, shuffled } from "@/names";
import { useNearViewport } from "@/lib/near-viewport";
import { cn } from "@/lib/utils";

/**
 * The generated field: ~60 blobatars on a jittered grid, drifting on scroll.
 *
 * It used to *be* the second section, asserting "millions of options" with data
 * it made up. It is now the wall's backdrop, and only while the wall is empty —
 * see ADR 0011. An empty wall on launch day is strictly worse than sixty blobs,
 * and the cold-start window is real; once anybody has placed anything, what is
 * real is the foreground and this fades out from under it.
 *
 * Which is also why the heading left: it lives in the section now, out of the
 * middle, because the middle is where somebody has to be able to click.
 *
 * The field is generated on a jittered grid rather than from raw random
 * coordinates. Pure randomness clumps — you get three blobatars overlapping in
 * one corner and an empty quadrant next to it — whereas one blobatar per cell,
 * nudged off centre, reads as scattered while staying evenly spread.
 */
const COLS = 7;
const ROWS = 9;

/**
 * The heading sits in the middle, so cells whose centre falls inside this box
 * (in normalised 0–1 field coordinates) are skipped. Blobatars can still drift
 * near it, which is what keeps the hole from looking cut out with scissors.
 */
const SAFE = { x0: 0.28, x1: 0.72, y0: 0.36, y1: 0.64 };

/**
 * Three depth layers. The number a layer carries is its scroll parallax shift
 * and its scale in one: near blobatars are bigger and travel further, far ones
 * are smaller and barely move. Tying both to a single value is what makes the
 * depth read as depth rather than as two unrelated randomisations.
 */
const DEPTHS = [
  { shift: "1.5rem", size: "clamp(1.75rem, 4vw, 3.25rem)", label: false },
  { shift: "4rem", size: "clamp(2.25rem, 5.5vw, 4.5rem)", label: true },
  { shift: "8rem", size: "clamp(3rem, 7vw, 6rem)", label: true },
];

type Blob = {
  seed: string;
  name: string;
  left: number;
  top: number;
  depth: number;
  rotate: number;
  duration: number;
  delay: number;
};

export function Field({ faded = false }: { faded?: boolean }) {
  /*
   * The field is client-only, and waits for the scroll that reveals it.
   *
   * Client-only because it is built from `Math.random()`, so a prerendered
   * field and the one the client generates would never match, and because sixty
   * inline SVGs in the document costs a round trip on the way to first paint.
   *
   * Deferred to intersection rather than to mount because rendering it at
   * hydration put a thousand elements' worth of work directly into the window
   * Total Blocking Time measures — see `useNearViewport`. The heading below
   * renders either way, so the section is never empty of meaning.
   */
  const [ref, near] = useNearViewport<HTMLDivElement>();

  // Once per mount, not per render: a reshuffle on every state change would
  // make the wall flicker. Random per visit is the point — the claim is
  // "millions of options", and a field that is provably different on every
  // reload is the cheapest possible proof.
  const blobs = useMemo<Blob[]>(() => {
    if (!near) return [];

    const pool = shuffled(NAMES);
    const out: Blob[] = [];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // Cell centre, then a jitter of up to ±40% of a cell. Capping it below
        // half a cell is what stops neighbours from swapping places and
        // collapsing back into the clumping this grid exists to avoid.
        const x = (c + 0.5 + (Math.random() - 0.5) * 0.8) / COLS;
        const y = (r + 0.5 + (Math.random() - 0.5) * 0.8) / ROWS;

        if (x > SAFE.x0 && x < SAFE.x1 && y > SAFE.y0 && y < SAFE.y1) continue;
        // A tenth of the cells stay empty. A perfectly populated grid is still
        // legible as a grid; the gaps are what break the last of the rhythm.
        if (Math.random() < 0.1) continue;

        const name = pool[out.length % pool.length]!;
        out.push({
          seed: `${name}${Math.floor(Math.random() * 900) + 100}`,
          name,
          left: x * 100,
          top: y * 100,
          depth: Math.floor(Math.random() * DEPTHS.length),
          rotate: (Math.random() - 0.5) * 16,
          // Each blobatar floats on its own clock. Shared timing would have the
          // whole field rising and falling as one sheet, which is the one thing
          // a drifting crowd must not do.
          duration: 5 + Math.random() * 5,
          delay: -Math.random() * 10,
        });
      }
    }

    return out;
  }, [near]);

  return (
    /*
      A layer, not a section. It is positioned by whatever renders it — today
      the wall's own section, behind the canvas — and it keeps `overflow-clip`
      because the parallax layers below still resolve `animation-timeline:
      view()` against the nearest scroll container, and `hidden` would make
      this one.

      `faded` is the handover: the moment the wall has anything real on it,
      this goes. Transitioned rather than unmounted, so the field does not
      vanish mid-scroll the instant a chunk arrives — and kept mounted so the
      transition has something to run on.
    */
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-clip transition-opacity duration-700",
        faded ? "opacity-0" : "opacity-100",
      )}
    >
      {DEPTHS.map((depth, d) => (
        <div
          key={d}
          className="wall-layer absolute inset-0"
          style={{ "--wall-shift": depth.shift } as React.CSSProperties}
          // Decorative: the heading over it carries the meaning, and sixty
          // seeds announced one by one is noise to a screen reader.
          aria-hidden="true"
        >
          {blobs
            .filter(b => b.depth === d)
            .map(b => (
              <div
                key={b.seed}
                className="wall-float absolute"
                style={
                  {
                    left: `${b.left}%`,
                    top: `${b.top}%`,
                    // Centring goes on `translate`, not `transform`: the float
                    // animation owns `transform`, and the two would otherwise
                    // overwrite each other. Separate properties compose.
                    translate: "-50% -50%",
                    "--float-duration": `${b.duration}s`,
                    "--float-delay": `${b.delay}s`,
                  } as React.CSSProperties
                }
              >
                <div
                  className="flex flex-col items-center gap-1.5"
                  style={{ transform: `rotate(${b.rotate}deg)` }}
                >
                  {/*
                    `hover`, not `always`. Sixty blobatars idling continuously is
                    visual noise competing with the heading, and sixty live
                    animations under a scroll-linked transform is the one thing
                    that would make this section stutter. Still until pointed at.
                  */}
                  <Blobatar
                    name={b.seed}
                    animate="hover"
										className="shrink-0"
                    style={{ width: depth.size, height: depth.size }}
                  />
                  {/*
                    Only the two nearer depths are labelled. At the far size the
                    text would be smaller than it is readable, and a wall of
                    illegible captions is texture, not information.
                  */}
                  {depth.label && (
                    // Dropped below `sm`: the cells are narrow enough there
                    // that captions land on their neighbours.
                    <span className="text-ink/50 hidden font-mono text-[0.6rem] lowercase sm:block">
                      {b.name}
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      ))}

      {/*
        Feathered top and bottom so the field enters and leaves the section
        rather than being clipped by a hard edge.
      */}
      <div className="from-ground pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b to-transparent" />
      <div className="from-ground pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t to-transparent" />

    </div>
  );
}
