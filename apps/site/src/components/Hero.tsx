import { useState } from "react";
import { Avatar } from "morphatar/react";
import type { AvatarOptions, Variant } from "morphatar";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

type Bg = "squircle" | "circle" | "square" | "none";

/**
 * Eight stops around the wheel plus an auto chip.
 *
 * `hue` is genuinely tri-state — unset means the seed drives color, which is
 * the library's default and the more interesting behaviour. A bare 0-360 slider
 * has nowhere to express "unset", and implies a precision nobody tuning a
 * landing page wants.
 */
const HUES = [12, 40, 78, 140, 190, 225, 275, 320];

export function Hero() {
  const [seed, setSeed] = useState("alain00");
  const [variant, setVariant] = useState<Variant>("blob");
  const [bg, setBg] = useState<Bg>("none");
  const [hue, setHue] = useState<number | null>(null);

  const opts: AvatarOptions = {
    variant,
    background: bg === "none" ? false : bg,
    hue: hue ?? undefined,
  };

  return (
    /*
      The whole hero has to fit one viewport — the input is the invitation, and
      an invitation below the fold is not one. `justify-between` inside a
      `min-h-svh` column does that at any height without fixed magic numbers,
      and the avatar is sized in `vmin` so it shrinks with a short window rather
      than pushing the controls off the bottom.
    */
    <section className="mx-auto flex min-h-svh max-w-6xl flex-col justify-between px-6 py-12 sm:py-16">
      <div>
      <h1 className="text-[clamp(3rem,12vw,9rem)] leading-[0.82] font-medium tracking-[-0.055em]">
        morphatar
      </h1>

      <p className="text-muted mt-6 max-w-md text-balance text-base leading-relaxed">
        Deterministic geometric avatars from any string. No dependencies, about
        3.3&nbsp;KB.
      </p>
      </div>

      {/*
        `animate="always"` puts this on the inline-SVG path — roughly a dozen
        DOM nodes instead of one <img>. That is the trade the library documents,
        and a single hero avatar is exactly the case it is meant for.
      */}
      <div className="flex justify-center py-6">
        <Avatar
          seed={seed || " "}
          animate="always"
          {...opts}
          title={`Avatar for ${seed}`}
          className="size-[min(34vmin,17rem)]"
        />
      </div>

      <div className="flex flex-col items-center gap-6">
        {/*
          Flat input: a rule, not a box. The caret and the text are the only
          affordance, which is the point — it should read as a line of the page
          you happen to be able to type on.
        */}
        <label className="w-full max-w-sm">
          <span className="sr-only">Seed</span>
          <input
            value={seed}
            onChange={e => setSeed(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="type a name"
            className={cn(
              "border-line focus:border-ink w-full border-b bg-transparent pb-3 text-center",
              "text-2xl tracking-tight outline-none transition-colors duration-200",
              "placeholder:text-muted/50",
            )}
          />
        </label>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Segmented
            type="single"
            value={variant}
            onValueChange={v => v && setVariant(v as Variant)}
            aria-label="Variant"
          >
            <SegmentedItem value="blob">blob</SegmentedItem>
            <SegmentedItem value="character">character</SegmentedItem>
          </Segmented>

          <Segmented
            type="single"
            value={bg}
            onValueChange={v => v && setBg(v as Bg)}
            aria-label="Background"
          >
            <SegmentedItem value="none">none</SegmentedItem>
            <SegmentedItem value="squircle">squircle</SegmentedItem>
            <SegmentedItem value="circle">circle</SegmentedItem>
            <SegmentedItem value="square">square</SegmentedItem>
          </Segmented>

          <div
            className="border-line flex items-center gap-1.5 rounded-full border p-1"
            role="group"
            aria-label="Hue"
          >
            <button
              onClick={() => setHue(null)}
              aria-pressed={hue === null}
              className={cn(
                "rounded-full px-3 py-1 text-xs lowercase transition-colors",
                hue === null ? "bg-ink text-ground" : "text-muted hover:text-ink",
              )}
            >
              auto
            </button>
            {HUES.map(h => (
              <button
                key={h}
                onClick={() => setHue(h)}
                aria-label={`Hue ${h} degrees`}
                aria-pressed={hue === h}
                style={{ background: `oklch(0.72 0.15 ${h})` }}
                className={cn(
                  "size-5 rounded-full transition-transform duration-150",
                  hue === h ? "ring-ink scale-110 ring-2 ring-offset-2 ring-offset-ground" : "hover:scale-110",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
