import { Blobatar } from "@blobatar/react";
import type { BlobatarOptions } from "blobatar";
import type { Expression } from "blobatar/expression";
import { cn } from "@/lib/utils";

/**
 * One face in an expression picker: the blobatar wearing the pose, and the
 * pose's name under it.
 *
 * The blobatar rather than a label alone, because a pose is a *look* and the
 * only honest label for a look is the look — "mad" on two capsule eyes means
 * nothing until you have seen it. Seeded with whatever the picker is picking
 * for, so a grid reads as one creature's range rather than as fourteen
 * strangers.
 *
 * Lifted out of the hero when the wall needed the same control. It is the same
 * tile in both places by construction now, rather than by two people
 * remembering to keep them alike.
 */
export function PoseTile({
  name,
  expression,
  seed,
  opts,
  selected,
  onClick,
}: {
  name: string;
  expression: Expression;
  seed: string;
  opts?: BlobatarOptions;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl py-2 transition-colors duration-150",
        selected ? "bg-line/70" : "hover:bg-line/30",
      )}
    >
      {/* A space, not an empty string: an unnamed blobatar still has to render
          something, and the seed is what decides which something. */}
      <Blobatar name={seed || " "} {...opts} expression={expression} alt="" className="size-10" />
      <span
        className={cn(
          "font-mono text-[0.65rem] lowercase transition-colors",
          selected ? "text-ink" : "text-muted",
        )}
      >
        {name}
      </span>
    </button>
  );
}
