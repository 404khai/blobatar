import { createMemo } from "solid-js";
import { _parts, type BlobatarOptions } from "blobatar/internal";
import { blobatarUri } from "blobatar/uri";
import type { Animate } from "blobatar/internal";

type StaticProps = { animate?: false } & Record<string, unknown>;

type AnimatedProps = { animate: Animate } & Record<string, unknown>;

export type BlobatarProps = {
  name: string;
} & BlobatarOptions &
  (StaticProps | AnimatedProps);

export function Blobatar(props: BlobatarProps) {
  const opts = createMemo<BlobatarOptions>(() => ({
    size: props.size,
    background: props.background,
    palette: props.palette,
    hue: props.hue,
    tone: props.tone,
    normalize: props.normalize,
    contrast: props.contrast,
    title: props.title,
    expression: props.expression,
    traits: props.traits,
  }));

  const isAnimated = createMemo(() => !!props.animate);

  const src = createMemo(() =>
    isAnimated() ? "" : blobatarUri(props.name, opts()),
  );

  const parts = createMemo(() =>
    isAnimated()
      ? _parts(props.name, { ...opts(), animate: props.animate })
      : null,
  );

  const html = createMemo(() => parts()?.inner ?? "");

  return () => {
    const p = parts();
    if (p) {
      const { style, class: className, alt: _alt, ...svgRest } = props as unknown as Record<string, unknown>;
      const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      el.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      el.setAttribute("viewBox", "0 0 100 100");
      if (props.size) {
        el.setAttribute("width", String(props.size));
        el.setAttribute("height", String(props.size));
      }
      if (props.title) {
        el.setAttribute("role", "img");
        const titleEl = document.createElementNS("http://www.w3.org/2000/svg", "title");
        titleEl.textContent = props.title;
        el.appendChild(titleEl);
      } else {
        el.setAttribute("aria-hidden", "true");
      }
      const mergedStyle = { ...(p.vars as Record<string, string>), ...(style as Record<string, string>) };
      Object.entries(mergedStyle).forEach(([k, v]) => el.style.setProperty(k, String(v)));
      if (className) {
        el.setAttribute("class", String(className));
      }
      for (const [k, v] of Object.entries(svgRest)) {
        if (v !== undefined && v !== null) {
          el.setAttribute(k, String(v));
        }
      }
      if (p.bg) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", p.bg.d);
        path.setAttribute("fill", p.bg.fill);
        el.appendChild(path);
      }
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      if (p.cls) g.setAttribute("class", p.cls);
      g.innerHTML = html();
      el.appendChild(g);
      return el;
    }

    const { style, class: className, alt, ...imgRest } = props as unknown as Record<string, unknown>;
    const img = document.createElement("img");
    img.src = src();
    if (props.size) {
      img.width = props.size;
      img.height = props.size;
    }
    img.alt = (alt as string) ?? props.title ?? "";
    if (className) img.className = String(className);
    if (style && typeof style === "object") {
      Object.entries(style as Record<string, string>).forEach(([k, v]) => img.style.setProperty(k, String(v)));
    }
    for (const [k, v] of Object.entries(imgRest)) {
      if (v !== undefined && v !== null) {
        img.setAttribute(k, String(v));
      }
    }
    return img;
  };
}
