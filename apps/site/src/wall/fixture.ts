import { NAMES } from "@/names";
import { REACH, cell, cellIndex, chunkKey, chunkOf, type Cell } from "./geometry";
import { type ChunkBody, type Placement } from "./chunk";
import { FACE_NAMES } from "./expressions";

/**
 * A wall that never existed, for building the renderer against.
 *
 * Deterministic on purpose — a fixture that reshuffles is one you cannot eyeball
 * a change against, and every placement here is also asserted to have been
 * *legal in the order it was made*, so this doubles as a worked example of the
 * rules rather than a bag of coordinates that merely looks right.
 *
 * It is three things a real wall should be able to contain at once: a dense
 * core where everyone piled in, a bridge somebody walked outward a cell at a
 * time, and a word drawn in occupancy at the end of it.
 */

/** Deterministic noise. Not `Math.random`: see above. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * "HI", three cells wide a letter, five tall, as offsets from its top-left.
 *
 * Small enough that a handful of people could plausibly have made it, which is
 * the point of putting it in a fixture: it is the smallest thing that reads as
 * deliberate from far enough out, and the renderer has to make it legible.
 */
const WORD: Cell[] = [
  ...[0, 1, 2, 3, 4].flatMap((y) => [{ x: 0, y }, { x: 4, y }]),
  { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 },
  ...[0, 1, 2, 3, 4].map((y) => ({ x: 6, y })),
];

/**
 * When the fixture's wall started, as whole seconds since the epoch.
 *
 * A constant rather than a clock: this file must produce the same wall on every
 * run, and "two hours ago" in a fixture is a date that changes underneath the
 * test asserting it.
 */
const OPENED = 1_767_225_600; // 2026-01-01

/** How far the crowd has spread. Two chunks across, so a default viewport at
 * reading zoom sees a good deal of it but not all — the wall has to feel like
 * it continues past the edge of the screen. */
const RADIUS = 14;

/** Where the word was drawn, as the top-left of its 7x5 box. Far enough out to
 * be its own thing, close enough that the bridge to it is a few stones rather
 * than a project. */
const WORD_AT: Cell = { x: 46, y: -24 };

/**
 * The wall's history, in the order it was placed.
 *
 * Ordered rather than a set, because order is what makes it checkable: reach is
 * a rule about the wall as it stood at the time, so a fixture that is legal
 * only as a finished picture is not a fixture of anything.
 */
export function history(): (Cell & Placement)[] {
  const random = prng(0xb10b);
  const out: (Cell & Placement)[] = [];
  const taken = new Set<string>();

  const place = (rawX: number, rawY: number) => {
    // Through the constructor: a ring walk at radius zero counts from `-0`.
    const { x, y } = cell(rawX, rawY);
    const at = `${x},${y}`;
    if (taken.has(at)) return;
    taken.add(at);
    const name = NAMES[out.length % NAMES.length]!;
    out.push({
      x,
      y,
      index: cellIndex(x, y),
      // A number on the end of the name, exactly as the field this replaces
      // did it. Two people called the same thing get different blobs, and the
      // palette spread across the wall comes from the digits rather than from
      // anything anyone chose.
      seed: `${name}${100 + Math.floor(random() * 900)}`,
      expression: FACE_NAMES[Math.floor(random() * FACE_NAMES.length)]!,
      // Placed in order, a few hours apart — a wall filling up at a handful of
      // blobs a day, which is what the cooldown actually produces.
      at: OPENED + out.length * 12_000 + Math.floor(random() * 4_000),
    });
  };

  // The core, ring by ring outward, which is both how a crowd actually grows
  // and what makes every cell in it reachable from the one before.
  for (let r = 0; r <= RADIUS; r++) {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (Math.max(Math.abs(x), Math.abs(y)) !== r) continue;
        if (x * x + y * y > RADIUS * RADIUS) continue;
        // The outermost rings are thinned, so the crowd has a ragged edge
        // rather than the outline of a stamp.
        if (r > RADIUS - 3 && random() < 0.45) continue;
        place(x, y);
      }
    }
  }

  // Somebody walked out of the crowd toward the empty quarter, a stone at a
  // time. Each is within reach of the last and of nothing else, which is what
  // going anywhere on this wall actually costs.
  const stones = Math.ceil(Math.hypot(WORD_AT.x, WORD_AT.y) / (REACH - 4));
  for (let i = 1; i <= stones; i++) {
    const t = i / stones;
    place(Math.round(WORD_AT.x * t), Math.round(WORD_AT.y * t));
  }

  // And then wrote something, which is the only thing on this wall that had to
  // be agreed on in advance.
  for (const cell of WORD) place(WORD_AT.x + cell.x, WORD_AT.y + cell.y);

  // Two people who came out here to be by themselves.
  place(-RADIUS - 9, 6);
  place(4, RADIUS + 11);

  return out;
}

/**
 * The same history, grouped into the bodies a client would have fetched.
 *
 * `version` is the count of writes the chunk has seen, which for a fixture is
 * simply how many cells it holds — a real one increments per write and never
 * decrements, since placements are permanent.
 */
export function fixtureChunks(): ChunkBody[] {
  const bodies = new Map<string, ChunkBody>();
  for (const placement of history()) {
    const key = chunkKey(chunkOf(placement.x, placement.y));
    let body = bodies.get(key);
    if (!body) bodies.set(key, (body = { key, version: 0, cells: [] }));
    body.cells.push({
      index: placement.index,
      seed: placement.seed,
      expression: placement.expression,
      at: placement.at,
    });
    body.version++;
  }
  return [...bodies.values()];
}
