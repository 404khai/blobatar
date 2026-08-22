/**
 * `/llms.txt` — the API, in prose, at a fixed URL.
 *
 * The landing page is a client-rendered SPA: fetch it and you get an empty
 * `<div id="root">` and a script tag. Every claim the site makes about this
 * library is assembled in the browser, so for anything that reads HTML without
 * executing it — an LLM fetching a URL, a link unfurler, a crawler on a budget
 * — this file is the only description of blobatar at the domain.
 *
 * Derived from the package README rather than written beside it, because a
 * second hand-maintained description of the same API is a second thing to get
 * wrong. There is no editorial layer here: what ships is what the README says,
 * minus the parts a consumer cannot act on.
 */
import { dirname, join } from "node:path";
import { PAGES } from "./manifest";
import { absolute } from "./origin";

const REPO = "https://github.com/Alain00/blobatar";

/** Resolved through the package's own exports rather than by relative path,
 * for the reason the README gives for the apps doing the same: a path that goes
 * through `exports` breaks loudly if the package is restructured, and
 * `./package.json` is an export precisely so tooling can find the root. */
const README = join(
  dirname(Bun.resolveSync("blobatar/package.json", import.meta.dir)),
  "README.md",
);

export const LLMS_PATH = new URL("./public/llms.txt", import.meta.url).pathname;

/**
 * The rest of this domain, in the format llms.txt asks for.
 *
 * The README describes the package and stops there — correctly, since it ships
 * inside the package and cannot know what is deployed beside it. Everything a
 * reader of *this file* is missing is a URL on this site: where the endpoint is
 * documented, where its machine-readable description is, who to contact, and
 * what the one part of the site that stores anything stores.
 *
 * Built from `manifest.ts` rather than typed out, so a page added tomorrow is
 * listed here without anybody remembering. `/` is skipped — a reader who has
 * this file has already been to the domain — and so is anything the manifest
 * marks unindexable.
 */
function links(): string {
  const pages = PAGES.filter(page => page.indexable !== false && page.route !== "/").map(
    page => `- [${page.ogTitle}](${absolute(page.route)}): ${page.description}`,
  );

  return [
    "## On blobatar.dev",
    "",
    ...pages,
    `- [OpenAPI spec](${absolute("/openapi.json")}): the avatar endpoint as OpenAPI 3.1 — every parameter, its accepted values, and the error codes. Generated from the endpoint's own parser.`,
    `- [Sitemap](${absolute("/sitemap.xml")}): every indexable page here.`,
    "",
  ].join("\n");
}

export async function writeLlmsTxt() {
  const readme = await Bun.file(README).text();

  // Everything before "## Development" — build commands, the workspace layout
  // and the tuning grid describe contributing to blobatar, not using it, and
  // an agent reading this is doing the latter.
  const [usage] = readme.split("\n## Development");

  const text = usage!
    // llms.txt asks for H1, then a blockquote summary. The README opens with
    // exactly that shape already, one line short of the punctuation — so this
    // promotes its tagline rather than authoring a competing one, and slips the
    // two facts a reader of the file rather than the repo would otherwise lack:
    // how to install it, and where the source is.
    .replace(
      /^(# blobatar\n\n)(.+)\n/,
      (_, heading, tagline) =>
        `${heading}> ${tagline}\n\nInstall: \`bun add blobatar\` (or npm/pnpm/yarn). ` +
        `Source and issues: ${REPO}. MIT.\n`,
    )
    // Relative links resolve against the repo, not against this URL. Left
    // alone they would point at `/docs/...` on the site, which does not exist.
    .replace(
      /\]\(\.\/(docs\/[^)]+)\)/g,
      `](${REPO}/blob/main/packages/blobatar/$1)`,
    );

  await Bun.write(LLMS_PATH, `${text.trimEnd()}\n\n${links()}`);
}
