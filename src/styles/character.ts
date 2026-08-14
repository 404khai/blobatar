import type { Palette } from "../color";
import { arc, superellipse } from "../shape";
import type { Traits } from "../traits";

const EYES = ["dot", "ring", "line", "wink"] as const;
const MOUTHS = ["smile", "line", "o", "frown"] as const;
const HAIR = ["none", "rim", "fringe", "tall"] as const;

export function layout(t: Traits) {
  const hy = t.num("head.y", 51, 55);
  const hrx = t.num("head.rx", 25, 29.5);
  const hry = t.num("head.ry", 27, 32.5);
  const hn = t.num("head.n", 2.2, 5);

  const eyeStyle = t.pick("eyes", EYES);
  const ey = hy - t.num("eye.y", 2, 7);
  const gap = t.num("eye.gap", 8.5, 13);
  const er = t.num("eye.r", 2.4, 3.9);
  const squash = t.num("eye.squash", 0.8, 1.15);
  // A touch of asymmetry, on one eye only. Perfect symmetry reads as dead.
  const skew = t.jitter("eye.skew", 0.9);

  const hair = t.pick("hair", HAIR);
  const mouth = t.pick("mouth", MOUTHS);

  return {
    head: { cx: 50, cy: hy, rx: hrx, ry: hry, n: hn },
    hair:
      hair === "none"
        ? null
        : {
            style: hair,
            lift: t.num("hair.lift", 2, 6) + (hair === "tall" ? 4 : 0),
            pad: t.num("hair.pad", 1.6, 4),
          },
    ears: t.bool("ears", 0.6) ? { r: t.num("ear.r", 3.4, 5.2), x: hrx - 0.5 } : null,
    eyes: { style: eyeStyle, y: ey, gap, r: er, squash, skew },
    // Brow height is derived from the eye it sits above rather than drawn from
    // an independent range. Independent ranges overlap at the extremes, and a
    // brow fused to an eyelid is the single ugliest failure in the space.
    brows: t.bool("brows", 0.7)
      ? (() => {
          const th = t.num("brow.th", 0.75, 1.5);
          return {
            y: ey - (er * squash + th + Math.abs(skew) + t.num("brow.gap", 1.6, 3.6)),
            w: t.num("brow.w", 3.6, 6.2),
            th,
            rot: t.num("brow.rot", -16, 16),
          };
        })()
      : null,
    mouth: {
      style: mouth,
      y: hy + t.num("mouth.y", 9, 13),
      w: t.num("mouth.w", 3.8, 7.2),
      th: t.num("mouth.th", 0.8, 1.4),
      stroke: Math.round(t.num("mouth.stroke", 1.4, 2.2) * 100) / 100,
      // Frowns curve upward, eating into the gap below the eyes, so they get a
      // shallower range than smiles. They also just read better shallow.
      depth: mouth === "frown" ? -t.num("mouth.depth", 1.6, 3.2) : t.num("mouth.depth", 2.8, 5.4),
    },
    fringe: {
      cx: 50 + t.jitter("fringe.x", 2),
      cy: hy - hry * t.num("fringe.y", 0.5, 0.68),
      rx: hrx * t.num("fringe.rx", 0.82, 1),
      ry: t.num("fringe.ry", 4.5, 8.5),
      n: t.num("fringe.n", 3, 6),
    },
  };
}

export type Layout = ReturnType<typeof layout>;

export function render(l: Layout, p: Palette): string {
  const { head: h, eyes: e } = l;
  const out: string[] = [];

  const dot = (cx: number, cy: number, r: number) =>
    superellipse({ cx, cy, rx: r, ry: r * e.squash, n: 2 });

  // Hair behind the head: a slightly larger, lifted superellipse in hair color,
  // so the head occludes all but a rim. Cheaper and more robust than a clip
  // path, and it never needs a unique element id.
  if (l.hair) {
    const d = superellipse({
      cx: h.cx,
      cy: h.cy - l.hair.lift,
      rx: h.rx + l.hair.pad,
      ry: h.ry + l.hair.pad,
      n: h.n,
    });
    out.push(`<path d="${d}" fill="${p.hair}"/>`);
  }

  // Ears, behind the head so they peek out at the sides.
  if (l.ears) {
    out.push(
      `<g fill="${p.head}">` +
        `<path d="${dot(h.cx - l.ears.x, h.cy, l.ears.r)}"/>` +
        `<path d="${dot(h.cx + l.ears.x, h.cy, l.ears.r)}"/>` +
        `</g>`,
    );
  }

  out.push(`<path d="${superellipse(h)}" fill="${p.head}"/>`);

  const ink: string[] = [];
  const eye = (cx: number, cy: number, style: string) => {
    if (style === "line") {
      ink.push(`<path d="${superellipse({ cx, cy, rx: e.r * 1.1, ry: e.r * 0.28, n: 5 })}"/>`);
    } else {
      ink.push(`<path d="${dot(cx, cy, e.r)}"/>`);
      if (style === "ring") ink.push(`<path d="${dot(cx, cy, e.r * 0.4)}" fill="${p.bg}"/>`);
    }
  };

  eye(h.cx - e.gap, e.y, e.style === "wink" ? "dot" : e.style);
  eye(h.cx + e.gap, e.y + e.skew, e.style === "wink" ? "line" : e.style);

  if (l.brows) {
    const b = l.brows;
    ink.push(
      `<path d="${superellipse({ cx: h.cx - e.gap, cy: b.y, rx: b.w, ry: b.th, n: 5, rot: b.rot })}"/>`,
      `<path d="${superellipse({ cx: h.cx + e.gap, cy: b.y + e.skew, rx: b.w, ry: b.th, n: 5, rot: -b.rot })}"/>`,
    );
  }

  const m = l.mouth;
  if (m.style === "smile" || m.style === "frown") {
    ink.push(
      `<path d="${arc(h.cx, m.y, m.w, m.depth)}" fill="none" stroke="${p.ink}"` +
        ` stroke-width="${m.stroke}" stroke-linecap="round"/>`,
    );
  } else if (m.style === "o") {
    ink.push(
      `<path d="${superellipse({ cx: h.cx, cy: m.y, rx: m.w * 0.45, ry: m.w * 0.6, n: 2.4 })}"/>`,
    );
  } else {
    ink.push(`<path d="${superellipse({ cx: h.cx, cy: m.y, rx: m.w, ry: m.th, n: 5 })}"/>`);
  }

  out.push(`<g fill="${p.ink}">${ink.join("")}</g>`);

  if (l.hair?.style === "fringe") {
    out.push(`<path d="${superellipse(l.fringe)}" fill="${p.hair}"/>`);
  }

  return out.join("");
}

export const background = "squircle" as const;
