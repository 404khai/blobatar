/**
 * The head, which is the only part of this site a machine reads without
 * executing anything.
 *
 * Asserted against `render` rather than against `dist`, so the checks run in
 * `bun test` with no build. What they guard is the class of failure this file
 * has actually produced: a URL that came out relative. Every absolute URL in a
 * document is interpolated from `ORIGIN`, and a crawler resolves none of them
 * against the page it found them on — a relative `og:image` is no card, and a
 * relative canonical is no entity.
 */
import { expect, test, describe } from "bun:test";
import { render } from "./document";
import { PAGES } from "./manifest";
import { ORIGIN } from "./origin";

const documents = PAGES.map(page => [page, render(page)] as const);
const indexable = documents.filter(([page]) => page.indexable !== false);
const hidden = documents.filter(([page]) => page.indexable === false);

const jsonLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(
    match => JSON.parse(match[1]!),
  );

describe("every document", () => {
  test("names one canonical URL, absolute, at its own route", () => {
    for (const [page, html] of indexable) {
      expect(html).toContain(`<link rel="canonical" href="${ORIGIN}${page.route}" />`);
    }
  });

  /**
   * The wall preview renders fixture data and the 404 is what every wrong URL
   * resolves to. Both want to be crawled *through* — the 404 in particular is
   * a page of links out — and neither wants to be indexed as itself, which is
   * `noindex, follow`. A canonical would say the opposite, so it is asserted
   * absent rather than merely not written.
   */
  test("refuses indexing on the pages the manifest hides, and drops the canonical", () => {
    expect(hidden.length).toBeGreaterThan(0);
    for (const [, html] of hidden) {
      expect(html).toContain('<meta name="robots" content="noindex, follow" />');
      expect(html).not.toContain("rel=\"canonical\"");
    }
  });

  test("carries the four metadata signals entity resolution needs", () => {
    for (const [, html] of indexable) {
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<meta property="og:type" content="website" />');
      expect(html).toContain(`<meta property="og:image" content="${ORIGIN}/og.png" />`);
    }
  });

  test("has no root-relative URL left in an og tag", () => {
    // The failure this replaced a build-time string rewrite to prevent.
    for (const [, html] of documents) {
      expect(html).not.toMatch(/<meta property="og:(url|image)" content="\//);
    }
  });

  test("emits JSON-LD that parses", () => {
    for (const [, html] of documents) {
      for (const node of jsonLd(html)) {
        expect(node["@context"]).toBe("https://schema.org");
        expect(typeof node["@type"]).toBe("string");
      }
    }
  });

  /**
   * The escape, not the absence of a `<`.
   *
   * A `</script>` inside a JSON string closes the block in an HTML parser and
   * the rest of the node lands in the document as markup. Nothing in the
   * manifest contains one today, which is why this asserts on the mechanism.
   */
  test("escapes `<` inside a JSON-LD block", () => {
    const html = render({
      ...PAGES[0]!,
      schema: [{ "@context": "https://schema.org", "@type": "Thing", name: "</script>" }],
    });
    expect(html).not.toContain("</script></script>");
    expect(jsonLd(html).at(-1).name).toBe("</script>");
  });
});

describe("the homepage identity", () => {
  const html = render(PAGES.find(page => page.route === "/")!);
  const nodes = jsonLd(html);
  const typed = (type: string) => nodes.find(node => node["@type"] === type);

  test("declares the library as a free SoftwareApplication", () => {
    const app = typed("SoftwareApplication");
    expect(app.name).toBe("blobatar");
    expect(app.url).toBe(`${ORIGIN}/`);
    expect(app.description.length).toBeGreaterThan(50);
    expect(app.offers.price).toBe("0");
    // Off the library's own constant, so it cannot name a version that never
    // shipped — see `sync-version.ts`.
    expect(app.softwareVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("declares the maintainer as a person, reachable without an address", () => {
    const person = typed("Person");
    expect(person["@id"]).toBe(`${ORIGIN}/#alain`);
    expect(person.name).toBe("Alain");
    expect(person.contactPoint[0].url).toContain("/issues");
    expect(person.sameAs.length).toBeGreaterThan(1);
  });

  test("points the application at that one person rather than a copy", () => {
    expect(typed("SoftwareApplication").author).toEqual({ "@id": typed("Person")["@id"] });
  });

  /**
   * No email anywhere in a document, and no postal address.
   *
   * Both are fields the readiness audits ask for and both were declined on
   * purpose — this is a library with one developer, not a business with a
   * support desk or premises. Asserted rather than left to review, because the
   * way a personal address gets published is one well-meaning edit that adds a
   * contact field to a page nobody re-reads.
   */
  test("publishes no email address and no postal address", () => {
    for (const [, html] of documents) {
      expect(html).not.toContain("mailto:");
      expect(html).not.toMatch(/PostalAddress|"email"/);
    }
  });
});
