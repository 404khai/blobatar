import { useMemo } from "react";
import { Avatar } from "morphatar/react";
import { NAMES, shuffled } from "@/names";

const COLUMNS = 6;
const PER_COLUMN = 10;

/**
 * Differing shift per column is the whole parallax effect. The middle column
 * barely moves and the outer ones travel most, so the eye reads depth rather
 * than a sheet sliding past.
 */
const SHIFT = ["10rem", "3rem", "7rem", "1rem", "8.5rem", "4.5rem"];

export function Wall() {
  // Once per mount, not per render: a reshuffle on every state change would
  // make the wall flicker. Random per visit is the point — the claim is
  // "millions of options", and a field that is provably different on every
  // reload is the cheapest possible proof.
  const columns = useMemo(() => {
    const pool = shuffled(NAMES);
    const total = COLUMNS * PER_COLUMN;
    const seeds = Array.from(
      { length: total },
      (_, i) => `${pool[i % pool.length]}${Math.floor(Math.random() * 900) + 100}`,
    );
    return Array.from({ length: COLUMNS }, (_, c) =>
      seeds.slice(c * PER_COLUMN, (c + 1) * PER_COLUMN),
    );
  }, []);

  return (
    /*
      `overflow-clip`, not `overflow-hidden`. `hidden` makes this element a
      scroll container, and a scroll container is what `animation-timeline:
      view()` resolves against — so the columns measured their progress against
      a box that never scrolls and sat frozen at the identity transform. `clip`
      clips the same way without becoming a scroller.
    */
    <section className="relative overflow-clip py-32">
      <div
        // `justify-between` rather than a fixed gap: the columns spread edge to
        // edge at any width, which is what keeps this reading as a field rather
        // than a centered block floating in a wide viewport.
        className="flex w-full justify-between gap-4 px-6 sm:px-10"
        // Decorative: the heading over it carries the meaning, and 60 seeds
        // announced one by one is noise to a screen reader.
        aria-hidden="true"
      >
        {columns.map((col, i) => (
          <div
            key={i}
            className="wall-col flex flex-col gap-4 sm:gap-10"
            style={{ "--wall-shift": SHIFT[i] } as React.CSSProperties}
          >
            {col.map(seed => (
              /*
                `hover`, not `always`. Sixty avatars idling continuously is
                visual noise competing with the heading, and sixty live
                animations under a scroll-linked transform is the one thing
                that would make this section stutter. Still until pointed at.
              */
              <Avatar
                key={seed}
                seed={seed}
                animate="hover"
                className="size-14 shrink-0 sm:size-20 lg:size-28"
              />
            ))}
          </div>
        ))}
      </div>

      {/*
        Feathered top and bottom so the columns enter and leave the section
        rather than being clipped by a hard edge.
      */}
      <div className="from-ground pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b to-transparent" />
      <div className="from-ground pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t to-transparent" />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <h2 className="bg-ground/60 px-8 py-6 text-center text-[clamp(2.5rem,9vw,6rem)] leading-[0.9] font-medium tracking-[-0.05em] backdrop-blur-md">
          Millions
          <br />
          of options
        </h2>
      </div>
    </section>
  );
}
