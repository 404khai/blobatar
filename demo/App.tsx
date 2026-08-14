import { useMemo, useState } from "react";
import { avatar, type AvatarOptions, type Variant } from "../src/avatar";
import { traits } from "../src/traits";
import * as blob from "../src/styles/blob";

/**
 * The tuning harness.
 *
 * The point is the grid, not the single avatar. Numeric ranges can only be
 * judged in aggregate — you are looking for clusters, dead zones and outliers,
 * which are invisible when you inspect one seed at a time. The shape filter
 * exists because the rarer silhouettes would otherwise appear a handful of
 * times per page, which is too few to tune against.
 */

const COLS = 20;
const ROWS = 20;
const SHAPES = ["all", "round", "organic", "boxy", "nub", "cloud", "sun"] as const;

type Bg = "default" | "squircle" | "circle" | "square" | "none";

export function App() {
  const [variant, setVariant] = useState<Variant>("blob");
  const [prefix, setPrefix] = useState("user-");
  const [page, setPage] = useState(0);
  const [bg, setBg] = useState<Bg>("default");
  const [shape, setShape] = useState<(typeof SHAPES)[number]>("all");
  const [hue, setHue] = useState<number | "">("");
  const [focus, setFocus] = useState<string | null>(null);

  const opts: AvatarOptions = useMemo(
    () => ({
      variant,
      background: bg === "default" ? undefined : bg === "none" ? false : bg,
      hue: hue === "" ? undefined : hue,
    }),
    [variant, bg, hue],
  );

  const count = COLS * ROWS;

  // Filtering by shape means scanning forward past the seeds that do not match,
  // so a rare silhouette still fills a whole page.
  const seeds = useMemo(() => {
    const out: string[] = [];
    const wanted = variant === "blob" && shape !== "all" ? shape : null;
    for (let i = page * count; out.length < count && i < page * count + count * 200; i++) {
      const seed = `${prefix}${i}`;
      if (!wanted || blob.layout(traits(seed)).shape === wanted) out.push(seed);
    }
    return out;
  }, [prefix, page, shape, variant, count]);

  const stats = useMemo(() => {
    const sizes = seeds.map(s => avatar(s, opts).length);
    return {
      min: Math.min(...sizes),
      max: Math.max(...sizes),
      avg: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length),
    };
  }, [seeds, opts]);

  return (
    <main>
      <header>
        <h1>morphatar</h1>
        <div className="controls">
          <label>
            variant
            <select value={variant} onChange={e => setVariant(e.target.value as Variant)}>
              <option value="blob">blob</option>
              <option value="character">character</option>
            </select>
          </label>
          <label>
            shape
            <select
              value={shape}
              onChange={e => (setShape(e.target.value as typeof shape), setPage(0))}
              disabled={variant !== "blob"}
            >
              {SHAPES.map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            seed prefix
            <input value={prefix} onChange={e => (setPrefix(e.target.value), setPage(0))} />
          </label>
          <label>
            background
            <select value={bg} onChange={e => setBg(e.target.value as Bg)}>
              {(["default", "squircle", "circle", "square", "none"] as Bg[]).map(b => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={hue !== ""}
              onChange={e => setHue(e.target.checked ? 200 : "")}
            />
            lock hue
          </label>
          <label>
            <input
              type="range"
              min={0}
              max={360}
              value={hue === "" ? 0 : hue}
              onChange={e => setHue(Number(e.target.value))}
              disabled={hue === ""}
            />
          </label>
          <div className="spacer" />
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            ←
          </button>
          <code>page {page + 1}</code>
          <button onClick={() => setPage(p => p + 1)}>→</button>
        </div>
        <p className="stats">
          {seeds.length} avatars · svg {stats.min}–{stats.max} bytes (avg {stats.avg})
          {hue !== "" && ` · hue ${hue}°`}
        </p>
      </header>

      <div className="grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
        {seeds.map(seed => (
          <button
            key={seed}
            className="cell"
            title={seed}
            onClick={() => setFocus(seed)}
            dangerouslySetInnerHTML={{ __html: avatar(seed, opts) }}
          />
        ))}
      </div>

      {focus && (
        <div className="sheet" onClick={() => setFocus(null)}>
          <div className="card" onClick={e => e.stopPropagation()}>
            <div className="big" dangerouslySetInnerHTML={{ __html: avatar(focus, opts) }} />
            <div className="meta">
              <strong>{focus}</strong>
              <span>
                {avatar(focus, opts).length} bytes
                {variant === "blob" && ` · ${blob.layout(traits(focus)).shape}`}
              </span>
              <div className="swatches">
                {[...new Set(avatar(focus, opts).match(/#[0-9a-f]{6}/g) ?? [])].map(c => (
                  <span key={c} style={{ background: c }} title={c} />
                ))}
              </div>
              <textarea readOnly value={avatar(focus, opts)} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
