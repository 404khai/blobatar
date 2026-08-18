import { blobatar } from "blobatar/blob";
import { BadRequest, parseName, parseOptions } from "./params";

/** The one public path. Everything outside it is the site. */
export const PREFIX = "/avatar/";

/**
 * A day, then a month of serving stale while revalidating.
 *
 * The instinct for deterministic output is `immutable, max-age=31536000`, and
 * that is where this should end up — it is also the only lever that reduces
 * billed requests, since a Worker is charged per request whether it hits a
 * cache or not, so the caches that save money are the ones downstream.
 *
 * It is wrong *today*. The library guarantees determinism within a major
 * version, and at 0.x a major is a minor: the shape thresholds and tone set are
 * frozen per major precisely because changing them reshuffles every existing
 * blobatar. A year-long immutable cache would outlive that guarantee and leave
 * a reshuffle half-applied across the internet for a year, with no purge
 * possible on caches we do not own.
 *
 * `stale-while-revalidate` buys most of the win without the exposure: a repeat
 * viewer is served instantly from cache for a month while the revalidation
 * happens off the critical path.
 *
 * **Raise this to `immutable` when the URL carries the major** — `/avatar/v1/…`
 * — because then a reshuffle is a new URL rather than a new answer at an old
 * one, which is the actual precondition an immutable cache needs.
 */
const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=2592000";

/**
 * SVG is an active document format, and this one is served from the same origin
 * as the site.
 *
 * The markup carries no script, no external reference and no element ids, and
 * the single caller-supplied value (`title`) is escaped by the renderer. These
 * headers are the belt to that braces: `default-src 'none'` means a future
 * injection has nothing to reach for, and `nosniff` stops a browser deciding
 * this is HTML on its own initiative.
 *
 * Scoped to this route rather than applied site-wide — the landing page needs
 * its own styles and scripts, and a `default-src 'none'` over the whole origin
 * would blank it.
 */
const SECURITY = {
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  "x-content-type-options": "nosniff",
} as const;

const USAGE = `blobatar — deterministic avatars over HTTP

  GET /avatar/<name>

A name is anything that stands for somebody: a username, an email, an id,
a Gravatar hash. The same name always renders the same blobatar.

Parameters (all optional, named as the library names them):

  size, s     8-1024, clamped rather than rejected
  background  none | square | circle | squircle
  hue         0-360 degrees, locks colour so the name drives shape only
  tone        0-1 position in the swatch set
  expression  idle | happy | sad | mad | surprised | wink | sleepy
              | smug | unsure | scared | love | shy | sick
  title       accessible name, 128 characters or fewer

Examples:

  /avatar/alain00
  /avatar/alain%40example.com?size=64
  /avatar/team-rocket?background=squircle&expression=smug

Replacing Gravatar
------------------
Swap the host and keep the rest of the URL:

  https://www.gravatar.com/avatar/<hash>?s=200&d=identicon
  https://blobatar.dev/avatar/<hash>?s=200&d=identicon

d, f and r are accepted and ignored — every string renders, so there is
no missing avatar to fall back to and nothing above a G rating to filter.
Code using d=404 to detect "this user has no Gravatar" now gets a 200.

The hash is used as the name. Gravatar's digest is one-way, so the email
cannot be recovered — but the digest is itself derived from the email, so
each person still gets one stable distinct blobatar. It will not be the
same one /avatar/<email> gives: pick one scheme per application.

To keep real Gravatars and use blobatar only for people without one, pass
this endpoint as Gravatar's own fallback instead:

  https://www.gravatar.com/avatar/<hash>?d=<url-encoded blobatar url>

Names are NFC-normalized, trimmed and lowercased before hashing, so
/avatar/Alain and /avatar/alain render the same blobatar from different
URLs. Prefer one spelling: each is cached separately by every cache in
the path.

https://github.com/Alain00/blobatar
`;

/**
 * FNV-1a over the rendered markup.
 *
 * A body hash rather than a hash of the inputs, so the tag cannot claim two
 * renders match when a library upgrade has changed what they produce. 32 bits
 * is ample for revalidating one URL against its own past: a collision needs two
 * different bodies at the same URL, and the consequence is one stale render
 * until the `max-age` above expires rather than anything durable.
 *
 * Hand-rolled because the alternative in a Worker is `crypto.subtle.digest`,
 * which is async and would make the whole handler async to compute a checksum
 * over 700 bytes.
 */
function etag(body: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `"${(h >>> 0).toString(36)}"`;
}

const text = (body: string, status: number) =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Errors and help are the one thing here that is not deterministic across
      // deploys — a new parameter changes both. Kept out of caches so a fix
      // takes effect when it ships.
      "cache-control": "no-store",
      ...SECURITY,
    },
  });

/**
 * The endpoint, as a function of one Request.
 *
 * Deliberately free of Workers-specific APIs — no `caches.default`, no `env`,
 * no `ctx`. That is not portability for its own sake; it is what lets the whole
 * thing be tested under `bun test` with no mocking and no runtime, which is the
 * same bargain the rest of the repo makes.
 *
 * The Cache API is the notable omission. It saves CPU on a hit, and CPU is the
 * one resource already free here: generation measures 12µs, against 30M CPU-ms
 * included per month — about 300M requests' worth. It does not save a single
 * billed request, because a Worker is charged per request either way. So a
 * cache lookup would add a round trip to the colo's store in front of work that
 * is faster than the lookup, to save nothing. `Cache-Control` above is the part
 * that actually pays.
 */
export function avatar(request: Request): Response {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(`${request.method} not allowed`, {
      status: 405,
      headers: { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8", ...SECURITY },
    });
  }

  const url = new URL(request.url);
  // `/avatar/` with nothing after it is the one place the docs can live now
  // that the site owns `/`.
  if (url.pathname === PREFIX) return text(USAGE, 200);

  let body: string;
  try {
    body = blobatar(parseName(url.pathname, PREFIX), parseOptions(url.searchParams));
  } catch (e) {
    if (e instanceof BadRequest) return text(`${e.message}\n\n${USAGE}`, 400);
    throw e;
  }

  const tag = etag(body);
  const headers = {
    "content-type": "image/svg+xml; charset=utf-8",
    "cache-control": CACHE_CONTROL,
    etag: tag,
    // Anyone may embed one. An avatar endpoint that could not be read
    // cross-origin would have no purpose.
    "access-control-allow-origin": "*",
    ...SECURITY,
  };

  // Answered here rather than left to the platform, since the body is already
  // in hand and the comparison is a string equality.
  if (request.headers.get("if-none-match") === tag) {
    return new Response(null, { status: 304, headers });
  }

  // `null` for HEAD: a body on a HEAD response is a protocol error, and
  // constructing one only to have the runtime drop it is a coin flip on which
  // runtime you are in.
  return new Response(request.method === "HEAD" ? null : body, { headers });
}
