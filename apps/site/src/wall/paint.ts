import { _layout } from "blobatar";
import { blobatar } from "blobatar/blob";
import type { ChunkBody } from "./chunk";
import { CELL, cellToScreen, edgeMarker, visibleBox, type Camera, type Viewport } from "./camera";
import { faceOf } from "./expressions";
import { cellAt, chunkKey, chunksCovering, type Cell } from "./geometry";

/**
 * Drawing the wall.
 *
 * To a canvas, not to the DOM, and the existing field is the argument: sixty
 * inline SVGs at hydration was enough to show up in Total Blocking Time, which
 * is why that section waits for the viewport at all. A pannable wall holds
 * hundreds at once and moves them every frame, which is not a smaller version
 * of that problem. One canvas, one draw call per blob, and the DOM left for the
 * one cell the pointer is over.
 */

/**
 * The size a blobatar is rasterised at, once, and then scaled to whatever the
 * zoom asks for.
 *
 * 96 is a mild upscale at reading zoom and a larger one at maximum, which blobs
 * — smooth curves in flat colour — take better than text or line art would.
 * Rasterising per zoom level instead would multiply a cache that is already the
 * largest thing this component holds. It came down from 128 when the budget
 * below had to go up: the product of the two is the memory, and a wall shows
 * far more blobs at once than it needs detail in any one of them.
 */
const SPRITE_PX = 96;

/**
 * How many rasterised blobatars to keep.
 *
 * Every seed is different, so there is no sharing to exploit and the cache is
 * simply a window onto wherever the visitor has been. At 96px and four bytes a
 * pixel a full cache is on the order of 55MB, which is the price of not
 * re-rasterising the wall every time somebody pans back the way they came.
 *
 * It must exceed what a single frame can draw, and by a margin. At 400 it did
 * not: a zoomed-out viewport holds five hundred or more, so every frame evicted
 * the sprites it had drawn moments earlier in that same frame, the next frame
 * rebuilt them, each rebuild fired `onload`, and every `onload` asked for
 * another frame. A hundred SVGs rasterised per frame, forever, on an idle wall.
 * The guard below is the real fix — this number only has to be comfortable.
 */
const SPRITE_BUDGET = 1500;

/**
 * Below this zoom, blobatars are drawn as their colour and nothing else.
 *
 * Deliberately below `MIN_ZOOM`, which is to say: never, for now. The first
 * cut put it at 0.7 on the theory that a 48px blob is four pixels of eye and
 * not worth fetching — which was wrong about what people are looking at. A
 * face at 48px still reads as a face, and a wall of flat discs reads as a
 * palette swatch; the crowd stops being made of anybody. Dots stay in the file
 * as the not-yet-decoded fallback, and the zoom that earns them is the one the
 * overview tile will serve, much further out than anything reachable today.
 */
const SPRITE_ZOOM = 0.3;

const spriteKey = (seed: string, expression: string) => `${seed}|${expression}`;

const colours = new Map<string, string>();

/**
 * The blob's body colour, resolved through the library rather than guessed.
 *
 * `_layout` is the same resolution the renderer runs, so the dot drawn at low
 * zoom and the blobatar drawn at high zoom cannot disagree about what colour
 * somebody is. It is underscored and not public API; the editor reads it the
 * same way for the same reason.
 */
export function colourOf(seed: string, expression: string): string {
  const key = spriteKey(seed, expression);
  const known = colours.get(key);
  if (known) return known;
  const { palette } = _layout(seed, { expression: faceOf(expression) });
  const colour = palette.head ?? "#8a8a8a";
  colours.set(key, colour);
  return colour;
}

type Sprite = { image: HTMLImageElement; ready: boolean; used: number };

const sprites = new Map<string, Sprite>();

/**
 * Which frame is being drawn.
 *
 * Eviction is not allowed to touch a sprite the frame in progress has already
 * asked for, however old it is, because that is what turns a cache miss into a
 * loop rather than a cost. Least-recently-used is the wrong question inside a
 * single frame: everything on screen was used a moment ago.
 */
let frame = 0;

/**
 * A rasterised blobatar, or `null` while it is still decoding.
 *
 * Never blocks and never throws: a caller that gets `null` draws the colour dot
 * instead, so a blob resolves from a coloured cell into a face rather than
 * appearing out of nothing. `onReady` is how the canvas learns to redraw.
 */
export function spriteOf(
  seed: string,
  expression: string,
  onReady: () => void,
): HTMLImageElement | null {
  const key = spriteKey(seed, expression);
  const known = sprites.get(key);
  if (known) {
    // Touched, so eviction takes the least recently *used* rather than the
    // least recently created — panning back over a blob you have already seen
    // should not cost a re-raster.
    known.used = frame;
    sprites.delete(key);
    sprites.set(key, known);
    return known.ready ? known.image : null;
  }

  const image = new Image();
  const sprite: Sprite = { image, ready: false, used: frame };
  sprites.set(key, sprite);
  image.onload = () => {
    sprite.ready = true;
    onReady();
  };
  // A failed decode stays unready forever and keeps drawing as a dot, which is
  // the correct degradation: the wall is still the right shape and the right
  // colours, it is simply less detailed.
  image.onerror = () => sprites.delete(key);
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    blobatar(seed, { expression: faceOf(expression), size: SPRITE_PX }),
  )}`;

  return null;
}

/**
 * Drop the coldest sprites, and only ones this frame has not drawn.
 *
 * Running after the frame rather than during it is what makes that guarantee
 * cheap to state: by the time this is called, `used === frame` means "on screen
 * right now", and those are exactly the ones that must survive. If everything
 * in the cache is on screen the cache simply runs over budget for a while,
 * which costs memory — the alternative cost it forever.
 */
function evict() {
  if (sprites.size <= SPRITE_BUDGET) return;
  for (const [key, sprite] of sprites) {
    if (sprites.size <= SPRITE_BUDGET) break;
    if (sprite.used !== frame) sprites.delete(key);
  }
}

/** The gutter. A blob does not fill its cell — the lattice reads as a lattice
 * because of the thin ground showing between neighbours. */
export const FILL = 0.88;

function dot(ctx: CanvasRenderingContext2D, sx: number, sy: number, size: number, colour: string) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(sx, sy, size / 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * The cell under the pointer is not drawn here at all.
 *
 * It is a real `<Blobatar>` laid over the canvas by `WallCanvas`, because the
 * library animates a pose with CSS and a rasterised sprite cannot animate at
 * all. This file draws the crowd; the DOM draws the one you are asking about.
 * Skipping it here is what stops the still copy from showing through while the
 * live one moves.
 */

export type Scene = {
  camera: Camera;
  view: Viewport;
  chunks: Map<string, ChunkBody>;
  /** The cell the DOM overlay is covering, if any. Left undrawn — see above. */
  skip?: Cell | null;
  /** The visitor's own blob, ringed so it can be picked out of the crowd. */
  mine?: Cell | null;
  /** Redraw, because a sprite finished decoding since the last frame. */
  onSpriteReady: () => void;
};

/**
 * One frame.
 *
 * Cleared and redrawn whole rather than damaged in regions: at these counts the
 * bookkeeping to track dirty rectangles costs more than the fills it saves, and
 * a pan invalidates everything anyway.
 */
export function paint(ctx: CanvasRenderingContext2D, scene: Scene) {
  const { camera, view, chunks } = scene;
  frame++;
  ctx.clearRect(0, 0, view.width, view.height);

  const size = CELL * camera.zoom * FILL;
  const detailed = camera.zoom >= SPRITE_ZOOM;

  // One cell of margin, so a blob whose centre is just off screen still draws
  // the half of itself that is on it.
  const box = visibleBox(camera, view, 1);

  for (const chunk of chunksCovering(box.x0, box.y0, box.x1, box.y1)) {
    const body = chunks.get(chunkKey(chunk));
    if (!body) continue;

    for (const placement of body.cells) {
      const at = cellAt(chunk, placement.index);
      if (at.x < box.x0 || at.x > box.x1 || at.y < box.y0 || at.y > box.y1) continue;

      if (scene.skip && at.x === scene.skip.x && at.y === scene.skip.y) continue;

      const screen = cellToScreen(camera, view, at.x, at.y);
      const sprite = detailed
        ? spriteOf(placement.seed, placement.expression, scene.onSpriteReady)
        : null;

      if (sprite) ctx.drawImage(sprite, screen.x - size / 2, screen.y - size / 2, size, size);
      else dot(ctx, screen.x, screen.y, size, colourOf(placement.seed, placement.expression));
    }
  }

  if (scene.mine) {
    // On screen it is ringed; off screen it becomes an arrow pinned to the edge
    // pointing at where it went. The arrow is drawn here rather than as a DOM
    // element so that it moves with the wall on the same frame the wall does —
    // a chevron lagging the drag by a React render is the one thing that would
    // make it read as chrome rather than as part of the surface.
    const marker = edgeMarker(camera, view, scene.mine);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.fillStyle = "rgba(255,255,255,0.85)";

    if (marker) {
      ctx.save();
      ctx.translate(marker.x, marker.y);
      ctx.rotate(marker.angle);
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-6, -6.5);
      ctx.lineTo(-6, 6.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      const screen = cellToScreen(camera, view, scene.mine.x, scene.mine.y);
      ctx.lineWidth = Math.max(1.5, size * 0.05);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size * 0.66, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  evict();
}
