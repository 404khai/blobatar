import type { CSSProperties, FC } from "react";
import { Blobatar } from "@blobatar/react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Expression } from "blobatar/expression";
import { idle, surprised } from "blobatar/expression";
import { morph } from "./reel";
import { WithFaces, gazeVars, type Faces } from "./face";
import { MONO, SANS } from "./fonts";
import {
  B_CARD,
  B_PULL,
  CAST,
  SWAP,
  blinkTimeAt,
  burstAt,
  BLOB,
  CELL,
  COLS,
  COUNT,
  FPS,
  GRID_Y,
  HEIGHT,
  HERO_COL,
  HERO_ROW,
  HERO_X,
  HERO_Y,
  PULL_TO,
  WIDTH,
  GRID,
  HERO,
  ROLL,
  ROW_AT,
  ROW_END,
  SHOWCASE_CELLS,
  camera,
  ICON,
  cookieScaleAt,
  cursorAt,
  holdAt,
  lookAt,
  travelAt,
} from "./watch";
import "blobatar/motion.css";
import "./seek.css";
/* §4.5 and §4.8 entire: the channel registrations, the per-eye projection on
   `.mo-eye`, and the idle stand-down. The film adds no stylesheet of its own
   any more — the sphere cues it used to approximate with a `scale` are what
   the library now ships, computed properly from the projection. */
import "blobatar/gaze.css";

const BG = "#0b0b0c";
const TEXT = "#f2f2f3";
const MUTED = "#8a8a8f";

const ease = Easing.inOut(Easing.cubic);

const ramp = (
  frame: number,
  from: number,
  to: number,
  a: number,
  b: number,
  easing = ease,
) =>
  interpolate(frame, [from, to], [a, b], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const HERO_INDEX = HERO_ROW * COLS + HERO_COL;

/**
 * A cell's opacity: staggered in by distance from the hero, then dimmed under
 * the card.
 *
 * The stagger is the launch film's, at the same rate, because it is the same
 * crowd arriving around the same creature and two films disagreeing about how
 * fast that happens would read as one of them being wrong.
 *
 * What it buys here is different, though. There the arrival *is* the beat. Here
 * it is cover for a fact about the shot: the crowd is mounted before the move
 * and is already tracking, so the blobatars reaching full opacity are blobatars
 * whose eyes are in the right place already. Fading them in mid-pursuit is what
 * makes the wide shot land as "they were all watching" rather than as a hundred
 * and eleven creatures turning to look at once.
 *
 * ## Two passes, because the pull back is now two moves
 *
 * The showcase row arrives on the first move and the field arrives on the
 * second. That is what keeps the row beat a shot of nine silhouettes rather
 * than of nine silhouettes in a crowd: at 1.45 the frame holds about six rows,
 * so without this the field is already there and the outlines the beat exists
 * to show are one texture among sixty.
 *
 * Both passes are the same stagger at the same rate, started from different
 * frames, and both open outward from the hero by the same radial distance the
 * launch film uses. The block's is simply the near half of it.
 */
function cellOpacity(frame: number, index: number, dist: number): number {
  const dim = ramp(frame, B_CARD + 6, B_CARD + 46, 1, 0.45);
  const at = SHOWCASE_CELLS.has(index) ? B_PULL + dist * 6 : ROW_END + dist * 3.2;
  return ramp(frame, at, at + 14, 0, 1, Easing.out(Easing.cubic)) * dim;
}

/**
 * One blobatar, carrying its own gaze as four inherited custom properties.
 *
 * On the wrapper rather than on the blobatar, because `<Blobatar>` composes its
 * own `className` and `style` from its props and an imperative write into
 * either is a race with React that the driver loses silently. That failure is
 * documented at length in `apps/demo/pointer.ts`; here it costs nothing to
 * avoid, since the channels inherit and a wrapper is one level up.
 */
const Cell: FC<{
  name: string;
  index: number;
  frame: number;
  faces: Faces;
  pose?: Expression;
  hero?: boolean;
}> = ({ name, index, frame, faces, pose, hero }) => {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const dist = Math.hypot(col - HERO_COL, row - HERO_ROW);
  const [gx, gy] = lookAt(frame, index);
  const face = faces.get(name);

  return (
    <div
      style={
        {
          position: "absolute",
          left: col * CELL,
          top: GRID_Y + row * CELL,
          width: CELL,
          height: CELL,
          display: "grid",
          placeItems: "center",
          opacity: hero
            ? ramp(frame, B_CARD + 6, B_CARD + 46, 1, 0.45)
            : cellOpacity(frame, index, dist),
          /* The signed direction is still written, because it is the layer's
             public channel and `check-gaze.ts` reads it back off a rendered
             frame to prove the film and the solve agree. Nothing in
             `gaze.css` positions anything from it any more. */
          "--mo-track-x": gx.toFixed(4),
          "--mo-track-y": gy.toFixed(4),
          ...(face ? gazeVars(face, gx, gy, travelAt(frame)) : null),
        } as CSSProperties
      }
    >
      <Blobatar name={name} animate="always" size={BLOB} expression={pose} />
    </div>
  );
};

/**
 * The two things that get watched, and the beat where one becomes the other.
 *
 * Neither rides the camera, and that is the shot rather than an oversight. A
 * pointer belongs to the screen and not to the page, so when the film pulls
 * back it is the grid that shrinks underneath while these stay exactly the size
 * they were. Anything else would read as them being part of the artwork rather
 * than the thing on top of it.
 *
 * ## Why the icon changes at all
 *
 * The two beats are making different claims and want different objects. The
 * close shot says *it watches you*, and the thing that is you on a screen is
 * your cursor. The wide shot says *they all watch the same thing*, and a crowd
 * cannot share a cursor: there is one pointer and it is yours, so a hundred and
 * twenty creatures tracking it reads as a hundred and twenty creatures tracking
 * *you*, which is the surveilled half of the question rather than the delightful
 * one. A cookie is an object in the room. They can all look at it and it is
 * nobody's.
 *
 * The swap costs the gaze nothing, which is what makes it safe. Both sit on the
 * same continuous path at the same aim point, so no eye in the field moves
 * because of it and the pop lands on a field that is already settled.
 */

/**
 * The pointer, leaving.
 *
 * Wind up and then snap out, which is the whole of the toon grammar: five
 * frames growing so the eye knows something is about to happen, three frames to
 * nothing so that it does. Anticipation is what separates a thing leaving from
 * a thing being deleted, and at this size it is the only cue there is room for.
 *
 * The tip is the path's origin, so the translate is the aim point with no
 * offset to keep in step, and the scale is taken about the tip for the same
 * reason: it has to shrink toward the thing the eyes are pointing at.
 */
const Cursor: FC<{ frame: number }> = ({ frame }) => {
  const { x, y } = cursorAt(frame);
  const scale =
    frame < SWAP - 3
      ? ramp(frame, SWAP - 8, SWAP - 3, 1, 1.18, Easing.out(Easing.quad))
      : ramp(frame, SWAP - 3, SWAP, 1.18, 0, Easing.in(Easing.quad));

  return (
    <svg
      width={40}
      height={44}
      viewBox="0 0 20 22"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transformOrigin: "0 0",
        transform: `translate(${x}px, ${y}px) scale(${scale})`,
      }}
    >
      <path
        d="M0.8 0.8 L0.8 17.4 L5.1 13.6 L7.8 19.6 L10.7 18.3 L8 12.4 L13.2 12.2 Z"
        fill={TEXT}
        stroke={BG}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
};

/**
 * The cookie, arriving.
 *
 * `spring` rather than a hand-rolled curve, and not for convenience: it is
 * derived from the frame, so it is safe under a renderer that hands frames to
 * several tabs out of order. A CSS transition is not, which is why `seek.css`
 * kills every one of them, and the failure there is intermittent rather than
 * visible, which is worse.
 *
 * Overshoot is the point. `damping` at 9 against a stiff spring lands about 25%
 * past full and settles in roughly half a second, which is a pop rather than a
 * fade. The rotation runs on the same clock at a quarter the amplitude and
 * unwinds to zero, so it reads as weight rather than as a spin.
 *
 * It is the harness's cookie on purpose. `apps/demo/App.tsx` draws the same one
 * for the same reason, which is that a field aimed 40px off reads exactly like
 * a field aimed correctly until there is something on screen to check it
 * against. The film needs that more than the harness does, because a viewer
 * gets one pass and cannot move the target themselves.
 *
 * Centred on the aim point rather than hung off it by a corner, so the geometry
 * is the solver's with nothing to keep in step. The demo's `.cookie` does the
 * same, in the same way, one `translate` after the position.
 */
const Cookie: FC<{ frame: number }> = ({ frame }) => {
  const { fps } = useVideoConfig();
  const { x, y } = cursorAt(frame);
  const pop = spring({
    frame: frame - SWAP,
    fps,
    config: { damping: 9, mass: 0.6, stiffness: 160 },
  });
  const spin = (1 - pop) * -14;
  /* In the room rather than on the glass. See `cookieScaleAt`. */
  const world = cookieScaleAt(frame);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        fontSize: ICON,
        lineHeight: 1,
        transform:
          `translate(${x}px, ${y}px) translate(-50%, -50%) ` +
          `scale(${(pop * world).toFixed(4)}) rotate(${spin}deg)`,
        /* Above a field of blobatars without a ring or a box around it, which
           would compete with the cells for being the thing you are looking at. */
        filter: "drop-shadow(0 3px 7px rgb(0 0 0 / 0.55))",
        opacity: ramp(frame, B_CARD, B_CARD + 30, 1, 0),
      }}
    >
      {"\u{1F36A}"}
    </div>
  );
};

/** The claim, and the place to go and have it done to you. */
const Card: FC<{ frame: number }> = ({ frame }) => {
  const opacity = ramp(frame, B_CARD + 16, B_CARD + 48, 0, 1);
  const lift = ramp(frame, B_CARD + 16, B_CARD + 48, 12, 0);

  return (
    <div
      style={{
        position: "absolute",
        top: HEIGHT / 2 - 78,
        left: 0,
        width: WIDTH,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        opacity,
        transform: `translateY(${lift}px)`,
      }}
    >
      <div
        style={{
          fontFamily: SANS,
          fontSize: 92,
          fontWeight: 500,
          letterSpacing: "-0.055em",
          lineHeight: 0.9,
          color: TEXT,
        }}
      >
        they watch you
      </div>
      <div style={{ fontFamily: MONO, fontSize: 27, color: MUTED }}>blobatar.dev</div>
    </div>
  );
};

export const Gaze: FC = () => {
  const frame = useCurrentFrame();
  const cam = camera(frame);

  /*
   * The reaction, derived per frame on the pose channels rather than left to
   * the library's own morph.
   *
   * `motion.css` morphs an expression with a CSS transition, which has no local
   * time to seek: it starts when a value changes, measured against a wall clock
   * the renderer has stopped, so it never advances. `seek.css` kills it for that
   * reason and `reel.ts` exports the replacement, which lerps the pose channels
   * the transition would have interpolated and lands the same face on the same
   * frame. Reusing it rather than writing a second one, because two answers to
   * "what is this pose halfway to that one" is the drift this repo keeps
   * getting bitten by.
   *
   * One `Expression` for the whole field, not one per cell: every blobatar
   * reacts to the same cookie at the same moment, so this is 1 lerp per frame
   * rather than 120.
   *
   * `undefined` off the beat, so the 340 frames that are not the reaction pay
   * nothing and carry no pose markup at all. The switch is invisible because
   * `burstAt` is exactly 0 on both sides of it, and a pose at 0 is the identity.
   */
  const burst = burstAt(frame);
  const pose = burst > 0 ? morph(idle, surprised, burst) : undefined;

  /*
   * The row and the field mount before they are seen, each twenty frames ahead
   * of its own arrival. That head start is what lets a move reveal blobatars
   * that are already tracking rather than ones that start from centre the
   * instant they become visible, which is the difference between "they were
   * watching" and "they noticed".
   *
   * It is also the render budget: every mounted blobatar is twelve animated
   * nodes the style engine walks per frame. Holding the field out of the tree
   * until the row beat is over keeps the close shot at one blobatar and the row
   * beat at nine, where mounting all 120 up front would have paid for a hundred
   * and eleven invisible ones through both.
   */
  const rowed = frame >= B_PULL - 20;
  const crowded = frame >= ROW_END - 20;

  return (
    <div
      style={
        {
          "--vid-t": `${(frame / FPS) * 1000}ms`,
          /* Held still while the pose is moving. See `blinkTimeAt`. */
          "--vid-blink-t": `${blinkTimeAt(frame)}ms`,
          /* The excursion is not published as a property any more. The
             stylesheet no longer reads it: under §4.8 the turn happens in
             `project()`, so the film folds `travelAt` straight into the
             per-eye channels and there is nothing left for `.mo-eyes` to
             resolve. The driver still reads it off the cascade because it has
             to get the number from somewhere; the film has it in hand. */
          "--mo-track-hold": holdAt(frame).toFixed(4),
          width: WIDTH,
          height: HEIGHT,
          background: BG,
          overflow: "hidden",
          position: "relative",
        } as CSSProperties
      }
    >
      <div
        className="gaze"
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "0 0",
          transform: `translate(${cam.x - HERO_X * cam.scale}px, ${
            cam.y - HERO_Y * cam.scale
          }px) scale(${cam.scale})`,
        }}
      >
        <WithFaces names={ROLL}>
          {(faces) => (
            <>
              {rowed &&
                Array.from({ length: COUNT }, (_, i) => {
                  if (i === HERO_INDEX) return null;
                  // The showcase row is on screen from the first move; the rest
                  // of the field only from the second.
                  if (!SHOWCASE_CELLS.has(i) && !crowded) return null;
                  return (
                    <Cell
                      key={i}
                      name={GRID[i]!}
                      index={i}
                      frame={frame}
                      faces={faces}
                      pose={pose}
                    />
                  );
                })}

              <Cell
                name={HERO}
                index={HERO_INDEX}
                frame={frame}
                faces={faces}
                pose={pose}
                hero
              />
            </>
          )}
        </WithFaces>
      </div>

      {frame < SWAP && <Cursor frame={frame} />}
      {frame >= SWAP && frame < B_CARD + 30 && <Cookie frame={frame} />}
      {frame >= B_CARD && <Card frame={frame} />}
    </div>
  );
};

/** Kept honest: the pull back has to end on the grid at its own scale. */
if (camera(PULL_TO).scale !== 1) {
  throw new Error("the pull back does not land on the grid");
}
