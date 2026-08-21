import { useCallback, useMemo, useRef, useState } from "react";
import { Blobatar } from "@blobatar/react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "../src/components/ui/popover";
import { PoseTile } from "../src/components/ui/pose-tile";
import { ChevronIcon } from "../src/components/ui/chevron";
import { cn } from "../src/lib/utils";
import {
  WallCanvas,
  type At,
  type Inspected,
  type WallApi,
} from "../src/components/WallCanvas";
import { FACES, FACE_NAMES, faceOf } from "../src/wall/expressions";
import { FIRST, type Cell } from "../src/wall/geometry";
import { mount } from "../mount";

/**
 * The wall, on its own, against fixture data.
 *
 * A development surface rather than a page anyone is meant to land on: the
 * section's real home is the landing page, but a full-height canvas is easier
 * to judge alone than wedged between a hero and a chat, and the chunk fetcher
 * does not exist yet. Placement here writes to the fixture in memory and to
 * nothing else, which is what the real one will do first — the network call
 * goes beside that, not in front of it.
 */

/**
 * Everything a popover needs, including where to put it.
 *
 * One piece of state for both popovers rather than two, because they are
 * mutually exclusive by construction — a cell is either somebody's or it is
 * empty — and two booleans that must never both be true is a bug waiting for a
 * slow afternoon.
 */
type Focus =
  | { kind: "place"; cell: Cell; at: At }
  | { kind: "who"; placement: Inspected; at: At };

function WallPreview() {
  const [face, setFace] = useState(FACE_NAMES[0]!);
  const [name, setName] = useState("");
  const [mine, setMine] = useState<Cell | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [faces, setFaces] = useState(false);
  const api = useRef<WallApi | null>(null);

  // Memoised: it is read by the draw loop, and a fresh object every render is
  // what used to make the canvas repaint from blank.
  const draft = useMemo(() => ({ seed: name || "you", expression: face }), [name, face]);

  const onReady = useCallback((ready: WallApi) => {
    api.current = ready;
  }, []);

  const onPick = useCallback((cell: Cell, at: At) => setFocus({ kind: "place", cell, at }), []);
  const onInspect = useCallback(
    (placement: Inspected, at: At) => setFocus({ kind: "who", placement, at }),
    [],
  );
  const dismiss = useCallback(() => {
    setFocus(null);
    // Otherwise the inner panel outlives the panel it was opened from, and
    // reopens with it the next time somebody clicks a cell.
    setFaces(false);
  }, []);

  const place = () => {
    if (focus?.kind !== "place") return;
    api.current?.place(focus.cell, draft.seed, draft.expression);
    setMine(focus.cell);
    dismiss();
  };

  return (
    <main className="bg-ground relative h-dvh w-dvw overflow-hidden">
      <WallCanvas
        draft={draft}
        mine={mine}
        pinned={focus?.kind === "place" ? focus.cell : null}
        onPick={onPick}
        onInspect={onInspect}
        onCameraMove={dismiss}
        onReady={onReady}
      />

      <Popover open={!!focus} onOpenChange={open => !open && dismiss()}>
        {/*
          A zero-size element pinned to the cell in viewport coordinates. Radix
          needs a real node to measure and flip against; the canvas has no nodes
          in it at all, so this is the one the wall lends it.
        */}
        <PopoverAnchor asChild>
          <div
            className="pointer-events-none fixed h-0 w-0"
            style={{ left: focus?.at.x ?? 0, top: focus?.at.y ?? 0 }}
          />
        </PopoverAnchor>

        <PopoverContent side="top" sideOffset={40} className="w-auto min-w-[19rem]">
          {focus?.kind === "who" ? (
            <div className="flex items-center gap-3">
              <Blobatar
                name={focus.placement.seed}
                expression={faceOf(focus.placement.expression)}
                style={{ width: 44, height: 44 }}
                className="shrink-0"
              />
              <div className="min-w-0">
                <div className="truncate font-mono text-sm">{focus.placement.seed}</div>
                <div className="text-ink/50 font-mono text-xs">
                  {new Date(focus.placement.at * 1000).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                  <span className="px-1.5 opacity-40">·</span>
                  {focus.placement.x}, {focus.placement.y}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/*
                A sentence, not a form — the same construction the hero uses and
                for the same reason. The question is the label, `htmlFor` makes
                clicking it focus the blank, and the blank is a dashed rule that
                grows with what you type rather than a box that says "data
                entry". Here it does one thing more than the hero's: the wall
                behind it is already drawing the blobatar this names, held on
                the cell the panel is pointing at.
              */}
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-lg">
                <label htmlFor="wall-name" className="text-muted cursor-text tracking-tight">
                  You found a nice spot,
                </label>
                <span
                  className={cn(
                    "inline-grid border-b border-dashed pb-0.5 transition-colors duration-200",
                    "border-line hover:border-muted focus-within:border-ink",
                  )}
                >
                  {/*
                    An invisible copy of the value is what carries the width, so
                    the blank is exactly as wide as the name. `whitespace-pre`
                    keeps a trailing space measurable, without which the caret
                    walks off the end of the rule.
                  */}
                  <span
                    aria-hidden="true"
                    className="invisible col-start-1 row-start-1 px-1 tracking-tight whitespace-pre"
                  >
                    {name || "someone"}
                  </span>
                  <input
                    id="wall-name"
                    autoFocus
                    value={name}
                    onChange={event => setName(event.target.value)}
                    placeholder="someone"
                    maxLength={24}
                    spellCheck={false}
                    autoComplete="off"
                    // `size={1}` is load-bearing: both elements share one grid
                    // cell, and an input's default intrinsic width is about
                    // twenty characters, which would set the column instead of
                    // the name.
                    size={1}
                    className={cn(
                      "col-start-1 row-start-1 w-full min-w-0 bg-transparent px-1",
                      "tracking-tight outline-none placeholder:text-muted/40",
                    )}
                  />
                </span>
              </div>

              {/*
                The faces as blobatars of the name being typed, not as labels. A
                row of words is a form; a row of your own face pulling seven
                expressions is what the wall is actually offering — and it is
                the only place the page shows that the avatar is a function of
                the string, by changing all seven at once as you type.
              */}
              {/*
                The same control the hero uses, and the same reason: a pose is a
                look, so the trigger wears the current one rather than naming it
                and the panel is fourteen faces of the name being typed. A
                `<select>` here would be fourteen words describing pictures.

                A panel opened from a panel, which is a shape worth being
                careful with — nested layers are where dismissal usually breaks.
                Radix stacks them, so escape and an outside click each close the
                innermost first, and the placement panel survives being browsed.
              */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg">
                {/*
                  The second half of the sentence, not a field label. The panel
                  asks two questions and neither of them is `expression:` — the
                  wall is a place people put themselves, and a form asking for
                  an enum value is the wrong register for that by a mile.
                */}
                <span className="text-muted tracking-tight">And you are feeling?</span>

                <Popover open={faces} onOpenChange={setFaces}>
                  <PopoverTrigger
                    aria-label="Expression"
                    className={cn(
                      "border-line flex items-center gap-2 rounded-full border py-1 pr-2.5 pl-1",
                      "font-mono text-sm lowercase transition-colors duration-150",
                      "hover:bg-line/30 hover:border-muted text-ink",
                    )}
                  >
                    <Blobatar
                      name={draft.seed}
                      expression={FACES[face]}
                      alt=""
                      className="size-6"
                    />
                    {face}
                    <ChevronIcon down={!faces} />
                  </PopoverTrigger>

                  <PopoverContent
                    side="top"
                    align="end"
                    sideOffset={10}
                    collisionPadding={16}
                    className="max-h-[var(--radix-popover-content-available-height)] w-72 overflow-y-auto"
                  >
                    <div className="grid grid-cols-4 gap-1" role="group" aria-label="All expressions">
                      {/*
                        The whole roster, the selected one included. A picker
                        that hides what you already chose makes you close it to
                        find out whether you chose it.
                      */}
                      {FACE_NAMES.map(each => (
                        <PoseTile
                          key={each}
                          name={each}
                          expression={FACES[each]!}
                          seed={draft.seed}
                          selected={each === face}
                          onClick={() => {
                            setFace(each);
                            setFaces(false);
                          }}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <button
                type="button"
                onClick={place}
                disabled={!name.trim()}
                className={cn(
                  "bg-ink text-ground rounded-full px-4 py-2 text-sm tracking-wide lowercase",
                  "transition-opacity duration-150 disabled:opacity-40",
                )}
              >
                leave it here
                <span className="pl-2 font-mono text-xs opacity-50">
                  {focus?.kind === "place" ? `${focus.cell.x}, ${focus.cell.y}` : ""}
                </span>
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-3 py-2 font-mono text-xs text-white/80 backdrop-blur">
        {mine ? (
          <button
            type="button"
            className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20"
            onClick={() => api.current?.flyTo(mine)}
          >
            find mine
          </button>
        ) : (
          <span className="px-2 text-white/50">click an empty cell</span>
        )}
        <button
          type="button"
          className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20"
          onClick={() => api.current?.flyTo(FIRST)}
        >
          origin
        </button>
      </div>
    </main>
  );
}

mount(<WallPreview />);
