import { useEffect, useState } from "react";

/**
 * `false` during the prerender and on the first client render, `true` from the
 * first effect onwards.
 *
 * The point is to keep something out of the prerendered HTML without lying to
 * React about it. Gating on `typeof window` instead would render different
 * markup on the server and the client's first pass, which is precisely the
 * mismatch hydration exists to catch; this renders the same thing in both and
 * then changes its mind, which is an ordinary update.
 *
 * Used for the two heaviest things on the page — the wall's field and the chat
 * demo, about eighty inline SVGs between them, all of it below the fold. Their
 * headings and copy are prerendered as normal; only the illustration waits, so
 * a reader who never runs the JavaScript still gets every word.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
