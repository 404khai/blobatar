/**
 * The page's second deliverable.
 *
 * The snippet is the first and still the important one: it names a seed and the
 * axes you pinned, and whoever runs it re-derives the blobatar. An export is the
 * opposite kind of thing — already derived, and never derivable again. It
 * carries no seed, no overrides and no generation, so the moment it is saved it
 * stops tracking the library: when the default generation moves, every snippet
 * ever copied keeps rendering the right blobatar for its major, and every
 * exported file quietly becomes a picture of one that is no longer rendered.
 *
 * That is a fair trade for the person who wants a PNG for a slide, and it is
 * the whole reason this is an *export* rather than a second way to get a
 * blobatar. The button says "Download" because that is what the browser is
 * about to do; everything else here says export, because that is what it is.
 *
 * Static in the rendering-mode sense — never animated. Not in the other sense
 * the word carries around here: an export is a fully *configured* blobatar too,
 * and the two meanings collide badly enough that `CONTEXT.md` keeps them apart.
 */
import { useEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PLACEHOLDER_SEED } from "@/editor/placeholder";
import type { Motion } from "@/editor/snippet";
import { blobatar, type TraitOverrides } from "blobatar";

/**
 * The one size a raster export can be, since a PNG has to pick one.
 *
 * Large enough to survive being dropped into a slide at whatever size anyone
 * uses it at, small enough that the canvas round-trip is imperceptible.
 */
const PNG_SIZE = 512;

export interface ExportMenuProps {
  name: string;
  traits: TraitOverrides;
  motion: Motion;
}

export function ExportMenu({ name, traits, motion }: ExportMenuProps) {
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  const seed = name || PLACEHOLDER_SEED;
  const file = filename(name);

  /**
   * No `size`.
   *
   * The library emits `width`/`height` only when asked, and an SVG that was not
   * asked scales to whatever it is dropped into — which is the reason to take
   * the vector one at all. Baking 512 in would make the export answer a
   * question the format does not have to answer. The PNG is the one that has to
   * pick.
   */
  function exportSvg() {
    save(svgBlob(blobatar(seed, { traits })), `${file}.svg`);
  }

  /**
   * Here `size` is not a preference but a requirement: an SVG loaded through a
   * blob URL has no intrinsic size in Firefox without `width`/`height`, and
   * `drawImage` of a sizeless image is a blank canvas rather than an error.
   */
  async function exportPng() {
    const url = URL.createObjectURL(svgBlob(blobatar(seed, { traits, size: PNG_SIZE })));
    try {
      const image = await loadImage(url);
      const canvas = document.createElement("canvas");
      canvas.width = PNG_SIZE;
      canvas.height = PNG_SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no 2d context");
      context.drawImage(image, 0, 0, PNG_SIZE, PNG_SIZE);
      save(await canvasBlob(canvas), `${file}.png`);
    } catch {
      // Unlike a refused clipboard, there is nothing on screen that stands in
      // for the file — a silent failure here is a button that does nothing. Say
      // so, briefly, and point at the SVG path, which cannot fail this way.
      setFailed(true);
      clearTimeout(timer.current ?? undefined);
      timer.current = setTimeout(() => setFailed(false), 2400);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-ink text-ground inline-flex h-11 overflow-hidden rounded-full">
        <button
          type="button"
          onClick={exportSvg}
          className="flex cursor-pointer items-center gap-2 px-5 text-sm transition-opacity hover:opacity-80"
        >
          <DownloadIcon />
          <span>Download SVG</span>
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-haspopup="menu"
              aria-label="Choose export format"
              className="border-ground/20 flex w-11 cursor-pointer items-center justify-center border-l transition-opacity hover:opacity-70"
            >
              <ChevronDownIcon />
            </button>
          </PopoverTrigger>

          <PopoverContent align="center" sideOffset={8} className="w-56 p-2" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={exportPng}
              className="hover:bg-line/60 flex w-full cursor-pointer flex-col rounded-xl px-3 py-2.5 text-left transition-colors"
            >
              <span className="text-sm">PNG</span>
              <span className="text-muted text-xs">
                {PNG_SIZE} × {PNG_SIZE} image
              </span>
            </button>

            {/*
              Only when motion is on. A note explaining that exports are static,
              sitting under a preview that is already holding still, would be
              answering a question nobody asked.
            */}
            {motion && (
              <p className="text-muted border-line mt-2 border-t px-3 pt-3 text-xs leading-relaxed">
                Motion is preview-only. Exports are static.
              </p>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <p aria-live="polite" className="text-muted h-4 text-xs">
        {failed ? "Could not encode the PNG — the SVG still works." : ""}
      </p>
    </div>
  );
}

const svgBlob = (svg: string) => new Blob([svg], { type: "image/svg+xml;charset=utf-8" });

function save(blob: Blob, as: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = as;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * A label, not an identifier.
 *
 * Worth being explicit about, because it looks like one: `A B` and `A-B` are
 * two different blobatars that land on the same filename, and a name with five
 * axes pinned exports under the same name as that name with none. Encoding the
 * config would fix both and produce filenames nobody wants to see in a
 * downloads folder. The file is the picture you were just looking at; the
 * snippet is the thing that identifies it.
 *
 * Its normalization is its own — NFC and whitespace, for the filesystem — and
 * deliberately not the seed's. Case survives here, because `Alain` and `alain`
 * are one blobatar but whoever typed the first would not recognise a file named
 * after the second.
 */
function filename(name: string) {
  const safe = name
    .trim()
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return safe ? `blobatar-${safe}` : "blobatar";
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("could not load the SVG for raster export"));
    image.src = src;
  });
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error("could not encode PNG"))), "image/png");
  });
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4"
    >
      <path d="m7 9 5 5 5-5" />
    </svg>
  );
}
