import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Blobatar } from "@blobatar/react";
import {
  FLIGHT_MS,
  cellToScreen,
  cellUnder,
  flightAt,
  panBy,
  zoomAt,
  type Camera,
  type Viewport,
} from "@/wall/camera";
import { chunkMap, placementAt, placements, type ChunkBody, type Placement } from "@/wall/chunk";
import { fixtureChunks } from "@/wall/fixture";
import {
  FIRST,
  cellIndex,
  cellKey,
  chunkKey,
  chunkOf,
  isPlaceable,
  nearestPlaceable,
  type Cell,
} from "@/wall/geometry";
import { CELL } from "@/wall/camera";
import { faceOf } from "@/wall/expressions";
import { FILL, paint } from "@/wall/paint";

/**
 * The wall, as a surface you can drag.
 *
 * Everything that decides *what* is true lives in `src/wall`; this file is only
 * the part that has to touch a browser — a canvas, a pointer, and a request
 * animation frame.
 *
 * Almost nothing here is React state, and that is the whole design. A drag
 * moves the camera sixty times a second, a hover moves the ghost as often, and
 * not one of those frames wants a render. State that changes per frame lives in
 * a ref and is drawn imperatively; React is left holding only the things that
 * change when a person decides something.
 */

export type Inspected = Placement & Cell;

/**
 * The one cell that is DOM rather than pixels.
 *
 * Either somebody's blobatar, playing its pose, or the translucent preview of
 * what the visitor would leave here. Both need things a canvas cannot give
 * them: the library animates an expression with CSS, and a name that fades in
 * has to be a real element to transition.
 */
type Spot =
  | { kind: "who"; cell: Cell; seed: string; expression: string }
  | { kind: "ghost"; cell: Cell };

/**
 * Where a popover should sit, in viewport coordinates.
 *
 * Viewport rather than canvas-relative so the anchor can be a fixed-position
 * element rendered anywhere in the tree, instead of something the canvas has to
 * host and keep in step with its own layout.
 */
export type At = { x: number; y: number };

type Props = {
  /** What the visitor would be placing, drawn as the ghost under the pointer. */
  draft: { seed: string; expression: string };
  /** Their existing blob, if they have one — ringed, and the target of the
   * locate control. */
  mine?: Cell | null;
  /**
   * A cell the ghost is held on regardless of where the pointer goes.
   *
   * Set while the placement popover is open. Without it the preview follows the
   * pointer onto the popover and away from the cell the popover is talking
   * about, so the panel says "this spot" while the blob it describes has
   * wandered off — and the one affordance the wall rests on stops meaning
   * anything at the moment it matters most.
   */
  pinned?: Cell | null;
  /** An empty cell was chosen, already resolved to somewhere placeable. */
  onPick?: (cell: Cell, at: At) => void;
  /** Somebody else's blob was clicked. Who, and when they arrived. */
  onInspect?: (placement: Inspected, at: At) => void;
  /**
   * The wall started moving.
   *
   * Anything anchored to a cell is stale the moment the camera does, and the
   * cheap honest answer is to dismiss it rather than to chase it. Fired once
   * per gesture, not per frame — a callback into React sixty times a second is
   * the thing this component is arranged to avoid.
   */
  onCameraMove?: () => void;
  /** Hands the surface's imperative bits to whatever renders the controls. */
  onReady?: (api: WallApi) => void;
};

export type WallApi = {
  flyTo: (cell: Cell) => void;
  /** Draw a placement into the wall immediately.
   *
   * Optimistic on purpose: the writer sees their own blob land at once, while
   * everybody else picks it up whenever their chunk's cache entry turns over.
   * A wall that waits for a round trip before acknowledging a click feels
   * broken in exactly the way a wall must not. */
  place: (cell: Cell, seed: string, expression: string) => void;
};

/** A drag under this many pixels is a click. Above it the pointer was panning,
 * and the release must not place anything — the single most annoying way for a
 * map to betray you. */
const DRAG_SLOP = 4;

export function WallCanvas({
  draft,
  mine = null,
  pinned = null,
  onPick,
  onInspect,
  onCameraMove,
  onReady,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera>({ ...FIRST, zoom: 1 });
  const viewRef = useRef<Viewport>({ width: 0, height: 0 });
  const hoverRef = useRef<Cell | null>(null);
  const frameRef = useRef(0);
  const flightRef = useRef<{ from: Camera; to: Camera; start: number } | null>(null);
  const dragRef = useRef<{ x: number; y: number; moved: number } | null>(null);

  /**
   * Props the draw loop reads, mirrored into a ref.
   *
   * `draft` is a fresh object on every parent render, so a `draw` that closed
   * over it changed identity on every render too — and the effect that sizes
   * the canvas depended on `draw`, so it re-ran and reassigned `canvas.width`,
   * which clears the canvas. That was the flicker: a full repaint from blank
   * every time any state anywhere above changed. `draw` is now stable and reads
   * through here instead.
   */
  const propsRef = useRef({ draft, mine, pinned, onPick, onInspect, onCameraMove });
  propsRef.current = { draft, mine, pinned, onPick, onInspect, onCameraMove };

  const chunksRef = useRef<Map<string, ChunkBody>>(chunkMap(fixtureChunks()));
  // Occupancy as a mutable set rather than rebuilt from the chunks on every
  // placement: a placement is the one thing that changes it, and it changes it
  // by exactly one cell.
  const takenRef = useRef<Set<string>>(new Set());

  const occupied = useCallback((x: number, y: number) => takenRef.current.has(cellKey(x, y)), []);
  const populatedRef = useRef(false);

  /*
   * The overlay is the one thing here that is allowed to cost a React render,
   * and it costs exactly one per cell — not per pointer move, and never per
   * frame. Its *position* is still set imperatively in the draw loop below,
   * because that changes with the camera.
   */
  const [spot, setSpot] = useState<Spot | null>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  /*
   * Where the overlay is and what it hides, advanced only at commit time.
   *
   * They cannot be written when the hover is *decided*, because that happens in
   * an event handler and the node it describes does not exist until React
   * commits. A frame landing in between then positioned the outgoing node at
   * the incoming cell — the stale blob appearing where the new one belongs —
   * and the incoming node mounted untransformed at the corner of the canvas.
   * Both symptoms, one cause: the refs and the element have to move together.
   */
  const spotAtRef = useRef<Cell | null>(null);
  const skipRef = useRef<Cell | null>(null);

  /** Put the overlay over its cell. Straight on the element: a CSS variable
   * would be inherited and recalculate every child's style; this touches one
   * node. */
  const placeSpot = useCallback(() => {
    const node = spotRef.current;
    const at = spotAtRef.current;
    if (!node || !at) return;
    const screen = cellToScreen(cameraRef.current, viewRef.current, at.x, at.y);
    const size = CELL * cameraRef.current.zoom * FILL;
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    node.style.transform = `translate(${screen.x - size / 2}px, ${screen.y - size / 2}px)`;
  }, []);

  /** One frame, at most, per animation frame. Pointer moves, wheel events and
   * sprite decodes all arrive faster than the display refreshes and each wants
   * a redraw; coalescing here means the expensive thing happens once. */
  const draw = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      const flight = flightRef.current;
      if (flight) {
        const t = (performance.now() - flight.start) / FLIGHT_MS;
        cameraRef.current = flightAt(flight.from, flight.to, t);
        if (t >= 1) flightRef.current = null;
        else draw();
      }

      const { mine: ringed } = propsRef.current;
      // The overlay rides the camera, so it is repositioned per frame as well
      // as at commit.
      placeSpot();

      paint(ctx, {
        camera: cameraRef.current,
        view: viewRef.current,
        chunks: chunksRef.current,
        skip: skipRef.current,
        mine: ringed,
        onSpriteReady: draw,
      });
    });
  }, [placeSpot]);

  /** Rebuilt whenever the chunk set changes wholesale, which for now is once. */
  useEffect(() => {
    const taken = new Set<string>();
    for (const placement of placements(chunksRef.current)) {
      taken.add(cellKey(placement.x, placement.y));
    }
    takenRef.current = taken;
    populatedRef.current = taken.size > 0;
    draw();
  }, [draw]);

  /**
   * The backing store follows the element, and the context is scaled so that
   * everything above goes on thinking in CSS pixels. Depends on nothing that
   * changes per render — see the note on `propsRef`.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      viewRef.current = { width: rect.width, height: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  /** Wheel, bound by hand: React's `onWheel` is passive and cannot
   * `preventDefault`, so a trackpad pinch would zoom the page instead. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      flightRef.current = null;
      propsRef.current.onCameraMove?.();
      const rect = canvas.getBoundingClientRect();
      // ctrl+wheel is what a trackpad pinch arrives as, and it wants a far
      // finer response than a mouse wheel's fixed notches.
      const intensity = event.ctrlKey ? 0.01 : 0.0016;
      cameraRef.current = zoomAt(
        cameraRef.current,
        viewRef.current,
        Math.exp(-event.deltaY * intensity),
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
      draw();
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [draw]);

  /**
   * Redraw when something React owns changes.
   *
   * The draw loop reads these through a ref, which keeps it stable but also
   * means nothing tells it they moved. Typing a name repaints the held ghost as
   * the blobatar it is becoming, which is the demo happening inside the
   * affordance.
   */
  /**
   * Commit the overlay: its cell, what it hides, and where it sits — before the
   * browser paints, and in the same pass that mounted the node.
   *
   * `useLayoutEffect` rather than `useEffect` because a frame between commit
   * and paint is exactly the window the flicker lived in.
   */
  useLayoutEffect(() => {
    spotAtRef.current = spot?.cell ?? null;
    skipRef.current = spot?.kind === "who" ? spot.cell : null;
    placeSpot();
    draw();
  }, [spot, placeSpot, draw]);

  useEffect(() => draw(), [draw, draft, mine, pinned]);

  /**
   * What the overlay is showing, resolved from the pointer and the held cell.
   *
   * A held cell outranks the pointer — it was already resolved through the
   * rules when it was picked, and while the popover is open the pointer has
   * left the wall for it.
   */
  const settle = useCallback(
    (hover: Cell | null) => {
      const held = propsRef.current.pinned;
      const cell = held ?? hover;
      if (!cell) {
        setSpot(null);
        return;
      }
      const there = placementAt(chunksRef.current, chunkOf(cell.x, cell.y), cellIndex(cell.x, cell.y));
      const next: Spot | null = there
        ? { kind: "who", cell, seed: there.seed, expression: there.expression }
        : held || isPlaceable(cell.x, cell.y, occupied, populatedRef.current)
          ? { kind: "ghost", cell }
          : null;
      setSpot(next);
    },
    [occupied],
  );

  // Both directions: holding a cell shows it, and letting go hands the overlay
  // back to wherever the pointer actually is — which may be nowhere, in which
  // case the preview has to go rather than linger on a cell nobody chose.
  useEffect(() => {
    settle(hoverRef.current);
  }, [pinned, settle]);

  /**
   * Redraw once the webfont is in.
   *
   * Canvas text does not reflow when a font finishes loading the way DOM text
   * does — whatever was painted keeps whichever face was available at the time.
   * Without this the name plates spend the first paint in the fallback and stay
   * there until something else happens to ask for a frame.
   */
  useEffect(() => {
    document.fonts?.ready.then(draw);
  }, [draw]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  useEffect(() => {
    onReady?.({
      flyTo: (cell: Cell) => {
        flightRef.current = {
          from: cameraRef.current,
          to: { ...cell, zoom: Math.max(cameraRef.current.zoom, 1) },
          start: performance.now(),
        };
        draw();
      },
      place: (cell: Cell, seed: string, expression: string) => {
        const chunk = chunkOf(cell.x, cell.y);
        const key = chunkKey(chunk);
        let body = chunksRef.current.get(key);
        if (!body) chunksRef.current.set(key, (body = { key, version: 0, cells: [] }));
        body.cells.push({
          index: cellIndex(cell.x, cell.y),
          seed,
          expression,
          at: Math.floor(Date.now() / 1000),
        });
        body.version++;
        takenRef.current.add(cellKey(cell.x, cell.y));
        populatedRef.current = true;
        draw();
      },
    });
  }, [draw, onReady]);

  const pointFrom = (event: React.PointerEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  /** Set straight on the element rather than through state: the cursor changes
   * on every pointer move, and a render per move is the thing this whole file
   * is arranged to avoid. */
  const cursor = (canvas: HTMLCanvasElement, value: string) => {
    if (canvas.style.cursor !== value) canvas.style.cursor = value;
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
    <canvas
      ref={canvasRef}
      className="h-full w-full touch-none select-none"
      style={{ cursor: "grab" }}
      onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId);
        flightRef.current = null;
        dragRef.current = { ...pointFrom(event), moved: 0 };
        cursor(event.currentTarget, "grabbing");
      }}
      onPointerMove={event => {
        const point = pointFrom(event);
        const drag = dragRef.current;

        if (drag) {
          const dx = point.x - drag.x;
          const dy = point.y - drag.y;
          const before = drag.moved;
          drag.moved += Math.abs(dx) + Math.abs(dy);
          // Once, on the frame the gesture stops being a click.
          if (before <= DRAG_SLOP && drag.moved > DRAG_SLOP) propsRef.current.onCameraMove?.();
          dragRef.current = { ...point, moved: drag.moved };
          cameraRef.current = panBy(cameraRef.current, dx, dy);
          // No preview mid-drag: something sliding under a hand that is moving
          // the wall reads as the wall being unstable.
          if (hoverRef.current) {
            hoverRef.current = null;
            settle(null);
          }
        } else {
          const at = cellUnder(cameraRef.current, viewRef.current, point.x, point.y);
          const was = hoverRef.current;
          cursor(event.currentTarget, occupied(at.x, at.y) ? "help" : "pointer");
          // A pointer crossing one cell fires dozens of moves and only one of
          // them changes anything. Without this the wall repaints — several
          // hundred blobs — for every pixel the mouse travels.
          if (was && was.x === at.x && was.y === at.y) return;
          hoverRef.current = at;
          settle(at);
        }
        draw();
      }}
      onPointerUp={event => {
        const drag = dragRef.current;
        dragRef.current = null;
        cursor(event.currentTarget, "grab");
        if (!drag || drag.moved > DRAG_SLOP) return;

        const point = pointFrom(event);
        const aimed = cellUnder(cameraRef.current, viewRef.current, point.x, point.y);
        const { onPick: pick, onInspect: inspect } = propsRef.current;

        /*
         * Two targets, not one. A click on somebody's blob asks who they are;
         * a click on empty wall asks for that cell. Running both through
         * `nearestPlaceable` was the bug that made clicking a stranger shove
         * the wall sideways to an empty cell nobody had aimed at.
         */
        const rect = event.currentTarget.getBoundingClientRect();
        const anchorFor = (cell: Cell, centred: boolean): At => {
          // A cell the camera is about to fly to ends up in the middle of the
          // viewport by definition, so anchoring to where it is *now* would
          // point the popover at the wall it is leaving.
          if (centred) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          const screen = cellToScreen(cameraRef.current, viewRef.current, cell.x, cell.y);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };

        if (occupied(aimed.x, aimed.y)) {
          const found = placementAt(chunksRef.current, chunkOf(aimed.x, aimed.y), cellIndex(aimed.x, aimed.y));
          if (found) inspect?.({ ...found, ...aimed }, anchorFor(aimed, false));
          return;
        }

        const target = nearestPlaceable(aimed, occupied, populatedRef.current);
        if (!target) return;

        // Only if they aimed somewhere that could not take it. Landing the
        // camera on a cell the visitor already clicked is a jolt with nothing
        // to explain it.
        const flying = target.x !== aimed.x || target.y !== aimed.y;
        if (flying) {
          flightRef.current = {
            from: cameraRef.current,
            to: { ...target, zoom: Math.max(cameraRef.current.zoom, 1) },
            start: performance.now(),
          };
        }
        hoverRef.current = target;
        settle(target);
        pick?.(target, anchorFor(target, flying));
        draw();
      }}
      onPointerLeave={event => {
        // The pointer leaving for the popover must not take the preview with
        // it; `pinned` is what keeps it, and clearing hover is still right.
        hoverRef.current = null;
        settle(null);
        dragRef.current = null;
        cursor(event.currentTarget, "grab");
        draw();
      }}
      />

      {/*
        The live cell. Keyed by its coordinates so moving to the next cell
        remounts it: that is what restarts the pose and re-fires the label's
        entry, where a reused node would sit there already animated.
      */}
      {spot && (
        <div
          key={`${spot.cell.x},${spot.cell.y},${spot.kind}`}
          ref={spotRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 will-change-transform"
        >
          <Blobatar
            name={spot.kind === "who" ? spot.seed : draft.seed}
            expression={faceOf(spot.kind === "who" ? spot.expression : draft.expression)}
            animate="always"
            className="h-full w-full"
            style={spot.kind === "ghost" ? { opacity: 0.45 } : undefined}
          />
          <span className="wall-plate text-ink/50 absolute top-full left-1/2 pt-1 font-mono text-[0.65rem] whitespace-nowrap">
            {spot.kind === "who" ? spot.seed : draft.seed}
          </span>
        </div>
      )}
    </div>
  );
}
