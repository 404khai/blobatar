/**
 * The files that exist to be found rather than read.
 *
 * `robots.txt`, `sitemap.xml`, `llms.txt`, `_redirects` and the footer that
 * points at them all describe the same set of pages, and every one of them is
 * a place that silently goes stale when a page is added — which is the whole
 * reason they are generated from `manifest.ts`. These tests assert the
 * generation held, not the contents of the list.
 */
import { expect, test, describe } from "bun:test";
import { ALIASES, PAGES } from "./manifest";
import { LLMS_PATH, writeLlmsTxt } from "./llms";
import { sitemap } from "./sitemap";
import { ORIGIN } from "./origin";
import { SITE_LINKS } from "./src/components/SiteNav";

const routes = new Set(PAGES.map(page => page.route));
const indexable = PAGES.filter(page => page.indexable !== false);
const xml = await sitemap();
const robots = await Bun.file(`${import.meta.dir}/public/robots.txt`).text();
// Written here rather than inside the block below: `describe` bodies are
// synchronous, and this file is generated — `llms.txt` does not exist in a
// fresh clone until something asks for it.
await writeLlmsTxt();
const llms = await Bun.file(LLMS_PATH).text();

describe("the sitemap", () => {
  test("lists every indexable page, absolute", () => {
    for (const page of indexable) {
      expect(xml).toContain(`<loc>${ORIGIN}${page.route}</loc>`);
    }
    expect([...xml.matchAll(/<loc>/g)]).toHaveLength(indexable.length);
  });

  test("leaves out what the manifest marks unindexable", () => {
    for (const page of PAGES.filter(page => page.indexable === false)) {
      expect(xml).not.toContain(`<loc>${ORIGIN}${page.route}</loc>`);
    }
    // The wall preview and the 404 are the pages this exists for. If either
    // ever becomes a real page, this is the test to change deliberately.
    expect(PAGES.filter(page => page.indexable === false).length).toBe(2);
  });

  test("is a well-formed urlset with parseable dates", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);
    for (const [, date] of xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
      expect(Number.isNaN(Date.parse(date!))).toBe(false);
    }
  });
});

describe("robots.txt", () => {
  test("points at the sitemap that is actually generated", () => {
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  test("still allows everything", () => {
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).not.toContain("Disallow:");
  });
});

describe("llms.txt", () => {
  test("opens the way llms.txt asks: an H1, then a blockquote summary", () => {
    expect(llms.startsWith("# blobatar\n\n> ")).toBe(true);
  });

  test("says when to reach for this, not just what it is", () => {
    // The section is in the package README, so this asserts the derivation
    // carried it rather than asserting a second copy of the words.
    expect(llms).toContain("## When to use it");
    expect(llms).toContain("Reach for blobatar when");
  });

  test("links every indexable page and both machine-readable files", () => {
    for (const page of indexable.filter(page => page.route !== "/")) {
      expect(llms).toContain(`(${ORIGIN}${page.route})`);
    }
    expect(llms).toContain(`(${ORIGIN}/openapi.json)`);
    expect(llms).toContain(`(${ORIGIN}/sitemap.xml)`);
  });

  test("has no repo-relative links left in it", () => {
    // They would resolve against this domain, where `/docs/expression-spec.md`
    // does not exist.
    expect(llms).not.toMatch(/\]\(\.\//);
  });
});

describe("the footer nav", () => {
  test("every internal link is a real route or a generated file", () => {
    const generated = ["/llms.txt", "/openapi.json", "/sitemap.xml"];
    for (const [href] of SITE_LINKS.filter(([href]) => href.startsWith("/"))) {
      expect(routes.has(href) || generated.includes(href)).toBe(true);
    }
  });

  test("reaches the documentation and the trust pages from the landing page", () => {
    // The landing page renders this nav; before it existed, `/docs`,
    // `/privacy` and the spec were linked from nowhere.
    const hrefs = SITE_LINKS.map(([href]) => href);
    for (const href of ["/docs", "/about", "/contact", "/privacy", "/openapi.json"]) {
      expect(hrefs).toContain(href);
    }
  });
});

/**
 * The 404, which is a page like any other here and a platform setting as well.
 *
 * `not_found_handling: "404-page"` in `wrangler.jsonc` looks for `404.html` by
 * that exact name, so the manifest entry's `name` is not cosmetic — rename it
 * and Cloudflare goes back to serving an empty body, silently, on the one
 * response nobody tests by visiting.
 */
describe("the 404 document", () => {
  const notFound = PAGES.find(page => page.name === "404");

  test("is built, at the filename Cloudflare looks for", async () => {
    expect(notFound).toBeDefined();
    const wrangler = await Bun.file(`${import.meta.dir}/wrangler.jsonc`).text();
    expect(wrangler).toContain('"not_found_handling": "404-page"');
  });

  test("is prerendered, since its readers are the ones that ran no JavaScript", () => {
    expect(notFound?.prerender).toBeFunction();
  });

  test("stays out of the sitemap and llms.txt", () => {
    expect(xml).not.toContain("<loc>${ORIGIN}/404</loc>".replace("${ORIGIN}", ORIGIN));
    expect(llms).not.toContain(`(${ORIGIN}/404)`);
  });
});

describe("the alias redirects", () => {
  test("point at pages that exist", () => {
    for (const { to } of ALIASES) expect(routes.has(to)).toBe(true);
  });

  test("do not shadow a page of their own", () => {
    for (const { from } of ALIASES) expect(routes.has(from)).toBe(false);
  });

  test("are permanent, since the target is the canonical URL", () => {
    for (const { status } of ALIASES) expect(status).toBe(301);
  });
});

describe("the manifest", () => {
  test("gives every page a unique name and route", () => {
    expect(new Set(PAGES.map(page => page.name)).size).toBe(PAGES.length);
    expect(routes.size).toBe(PAGES.length);
  });

  /**
   * Prose without JavaScript, which is the entire point of these four pages:
   * they are read by things that do not execute any. A page that forgot its
   * `prerender` thunk serves an empty `<div id="root">` to exactly the readers
   * it was written for, and looks perfect in a browser.
   */
  test("prerenders every written page", () => {
    for (const name of ["docs", "about", "contact", "privacy"]) {
      expect(PAGES.find(page => page.name === name)?.prerender).toBeFunction();
    }
  });

  test("gives every page a description long enough to be a description", () => {
    for (const page of PAGES) expect(page.description.length).toBeGreaterThan(60);
  });
});
