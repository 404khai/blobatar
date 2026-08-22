/**
 * Every page on the site, in one list.
 *
 * This file exists because adding a page used to mean editing five places that
 * had to agree and nothing checked that they did: a hand-copied ~70-line HTML
 * document, an entry module, the bundler's `entrypoints` array, a `finish()`
 * call beside it, and a pair of dev-server routes. Four of those five were
 * boilerplate around the same four facts — a title, a description, a URL and an
 * entry module — so they are stated here once and everything else is derived.
 *
 * `document.ts` renders each entry into an HTML file, `build.ts` bundles and
 * rewrites the list, `server.ts` routes it. None of the three keeps a second
 * copy of the list, so none of them can drift from this one.
 *
 * To add a page: write `pages/<name>.tsx`, add an entry below. That is all.
 */
import { VERSION } from "blobatar";
import type { ReactNode } from "react";
import { GITHUB_PROFILE, ISSUES, NPM, REPO, X_PROFILE, absolute } from "./origin";

export type Page = {
  /** Document name. Produces `<name>.html`, which is generated and gitignored. */
  name: string;
  /**
   * The URL it is served at.
   *
   * Doubles as `og:url`. Exactly one page must claim `"/"`; it becomes the
   * dev server's catch-all and is the only page whose route is not also
   * served at its `.html` spelling.
   */
  route: string;
  /** Module the document loads, relative to the site root. */
  entry: string;
  title: string;
  description: string;
  /** `og:title`. Separate from `title`, which carries the tagline a card should not. */
  ogTitle: string;
  /** `og:description`, when the card wants a shorter line than the meta tag. */
  ogDescription?: string;
  /**
   * Markup to put in `#root` at build time, as a thunk.
   *
   * A thunk, and an async one, so that the component tree is only imported by
   * whoever actually renders it. `server.ts` reads this same manifest and must
   * not pull the entire React app into the dev server process to do it.
   */
  prerender?: () => Promise<ReactNode>;
  /**
   * JSON-LD nodes for this page, one `<script type="application/ld+json">` each.
   *
   * Here rather than in `document.ts` for the same reason the title is: it is a
   * fact about the page. What is shared between pages — the identity every one
   * of them points at — is built once below and referenced by `@id`.
   */
  schema?: object[];
  /**
   * In `sitemap.xml`, and meant to be found. Defaults to true; the only page
   * that says otherwise is the wall preview, which is a development surface.
   */
  indexable?: boolean;
  /**
   * Load the bundle on `load` from an inline script rather than from a
   * `<script src>` the preload scanner finds. Buys first paint by delaying
   * interactivity — see the long note in `build.ts`.
   */
  defer: boolean;
};

/**
 * The identity behind the library, as one node every page can point at.
 *
 * A `Person`, not an `Organization`, and that is the substantive claim here
 * rather than a schema preference: blobatar is a library with one developer
 * behind it. An `Organization` node would imply a company, and the readers
 * this file exists for — the ones deciding whether to depend on this — are
 * better served by the truth than by the type that scores higher.
 *
 * No `address`, and no `email`. Schema.org would take both and the audits that
 * read this file ask for them, but there is no premises to name and the only
 * address available is a personal one. A fabricated address on the field that
 * exists to verify legitimacy is worse than an absent one, and a personal
 * address on a crawled page is a harvest waiting to happen. `contactPoint`
 * carries the routes that are already public and already the right ones:
 * issues, and the maintainer's profiles.
 *
 * `@id` rather than a copy: a crawler that reads three pages of this site
 * should come away with one maintainer who has three pages, not three people
 * who share a name.
 */
const MAINTAINER = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": absolute("/#alain"),
  name: "Alain",
  url: GITHUB_PROFILE,
  sameAs: [GITHUB_PROFILE, X_PROFILE],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "technical support",
      url: ISSUES,
      availableLanguage: ["English"],
    },
  ],
};

/**
 * The library itself, as the thing this site is about.
 *
 * `SoftwareApplication` rather than `SoftwareSourceCode`: what a reader of this
 * site installs is a released package, and the source is one of its properties
 * (`codeRepository`) rather than the entity. `softwareVersion` comes off the
 * library's own `VERSION` constant, which `sync-version.ts` keeps in step with
 * the changeset release, so this cannot describe a version that never shipped.
 */
const APPLICATION = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": absolute("/#blobatar"),
  name: "blobatar",
  url: absolute("/"),
  description:
    "Deterministic geometric blobatars from any string. A zero-dependency library for JavaScript, React, Vue, Svelte, Solid and Preact, plus an HTTP endpoint that renders one as SVG.",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  softwareVersion: VERSION,
  license: "https://opensource.org/licenses/MIT",
  codeRepository: REPO,
  downloadUrl: NPM,
  isAccessibleForFree: true,
  // Free, and stated as an offer because that is the field a machine reads to
  // find out. An omitted `offers` reads as "price unknown", not as "no price".
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@id": absolute("/#alain") },
  maintainer: { "@id": absolute("/#alain") },
  sameAs: [REPO, NPM],
};

/**
 * URLs that are somebody else's name for a page here.
 *
 * `/developers` is the path a machine looking for a developer portal tries
 * first, and this site's is at `/docs`. Rather than publish a second copy of
 * that page under a second URL — two documents to keep in step, and two
 * candidates for the canonical — the other spelling redirects to the one.
 *
 * Stated once and consumed twice: `build.ts` writes them into `dist/_redirects`
 * for Cloudflare's asset pipeline, and `server.ts` serves them in development.
 * A redirect that only exists in production is a link that works everywhere
 * except where it is being written.
 */
export const ALIASES: { from: string; to: string; status: number }[] = [
  { from: "/developers", to: "/docs", status: 301 },
  { from: "/api", to: "/docs", status: 301 },
];

export const PAGES: Page[] = [
  {
    name: "index",
    route: "/",
    entry: "./pages/index.tsx",
    title: "blobatar — deterministic geometric blobatars",
    description:
      "Deterministic geometric blobatars from any string. No dependencies, about 3.7 KB.",
    ogTitle: "blobatar",
    // The identity, on the page an agent or a crawler reaches first.
    schema: [APPLICATION, MAINTAINER],
    /*
     * The hero, the chat, the closing section and the wall's heading — every
     * word on the page. Not the blobatars: the wall is a canvas, which
     * prerenders to an empty element by definition. See the note above `finish`
     * in `build.ts`.
     */
    prerender: async () => {
      const { createElement } = await import("react");
      const { App } = await import("./src/App");
      return createElement(App);
    },
    defer: true,
  },
  /*
   * The wall, alone, against fixture data.
   *
   * A development surface, which is why it is neither prerendered nor deferred
   * and why nothing links to it: the section's real home is the landing page,
   * and it moves there once it is reading real chunks instead of a fixture.
   * Listed here rather than run through a one-off script so that it is built,
   * typechecked and served by exactly the same path as every other page.
   */
  {
    name: "wall",
    route: "/wall",
    entry: "./pages/wall.tsx",
    title: "blobatar wall — preview",
    description: "Development preview of the blobatar wall, against fixture data.",
    ogTitle: "blobatar wall",
    // Not in the sitemap: a fixture-backed development surface is not a page
    // anybody should be pointed at, and the wall's real home is the landing page.
    indexable: false,
    defer: false,
  },
  {
    name: "editor",
    route: "/editor",
    entry: "./pages/editor.tsx",
    title: "blobatar editor — tune one and take the code",
    description:
      "Tune a blobatar by hand — silhouette, body, eyes, colour — and copy the trait overrides that reproduce it.",
    ogTitle: "blobatar editor",
    ogDescription:
      "Tune a blobatar by hand and copy the trait overrides that reproduce it.",
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "blobatar editor",
        url: absolute("/editor"),
        description:
          "Tune a blobatar by hand — silhouette, body, eyes, colour — and copy the trait overrides that reproduce it.",
        applicationCategory: "DeveloperApplication",
        // It renders in the browser and talks to nothing. Stated because
        // "runs entirely client-side" is a real property of this tool.
        browserRequirements: "Requires JavaScript.",
        operatingSystem: "Any",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        isPartOf: { "@id": absolute("/#blobatar") },
        author: { "@id": absolute("/#alain") },
      },
    ],
    /*
     * Neither prerender nor defer, and both omissions are the same judgement
     * from opposite ends. Its first frame is worth nothing until it can be
     * dragged, and it would be a large frame — twenty controls and a dozen
     * shape tiles, well past the markup that measured worse than nothing on the
     * landing page. And a page that is only controls cannot buy paint with
     * interactivity: a visible-but-dead editor is a broken editor.
     *
     * Indexable, deliberately. Lighthouse scores per URL, so this page's
     * interactivity budget cannot touch the landing page's number, and "avatar
     * generator" is a thing worth being findable for.
     */
    defer: false,
  },
  /*
   * The written pages: what this is, how to call it, who to ask, and what it
   * stores. Four entries rather than one because they answer four different
   * questions and are linked from different places — an error body points at
   * `/docs`, a reader deciding whether to depend on this wants `/about`, and
   * the wall is the reason `/privacy` has anything to describe.
   *
   * All four are prerendered and deferred. They are prose: the whole of what
   * they are for is in the document, and nothing on them needs JavaScript to
   * be read at all — which is the point, since half their readers do not run
   * any.
   */
  {
    name: "docs",
    route: "/docs",
    entry: "./pages/docs.tsx",
    title: "blobatar docs — the avatar API and packages",
    description:
      "How to call the blobatar avatar endpoint, what parameters it takes, how errors come back, and which package to install. No key, no account.",
    ogTitle: "blobatar docs",
    ogDescription: "The blobatar avatar endpoint, its parameters, and the packages.",
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        name: "blobatar for developers",
        headline: "blobatar for developers",
        url: absolute("/docs"),
        description:
          "Reference for the blobatar avatar endpoint: the route, its parameters, caching, error codes, and the packages that render the same blobatars in-process.",
        about: { "@id": absolute("/#blobatar") },
        author: { "@id": absolute("/#alain") },
        // The spec is the thing this page describes in prose. Named so that a
        // reader arriving here machine-first can leave with the machine copy.
        mainEntity: {
          "@type": "WebAPI",
          name: "blobatar avatar endpoint",
          url: absolute("/docs#endpoint"),
          description:
            "GET /avatar/<name> renders a deterministic geometric avatar as SVG. No authentication.",
          documentation: absolute("/openapi.json"),
          provider: { "@id": absolute("/#alain") },
        },
      },
    ],
    prerender: async () => {
      const { createElement } = await import("react");
      const { Docs } = await import("./src/Docs");
      return createElement(Docs);
    },
    defer: true,
  },
  {
    name: "about",
    route: "/about",
    entry: "./pages/about.tsx",
    title: "About blobatar — deterministic avatars, MIT licensed",
    description:
      "What blobatar is, what it guarantees about determinism, stability and contrast, and who maintains it.",
    ogTitle: "About blobatar",
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "About blobatar",
        url: absolute("/about"),
        description: "What blobatar is, what it guarantees about determinism, stability and contrast, and who maintains it.",
        about: { "@id": absolute("/#blobatar") },
        author: { "@id": absolute("/#alain") },
      },
    ],
    prerender: async () => {
      const { createElement } = await import("react");
      const { About } = await import("./src/About");
      return createElement(About);
    },
    defer: true,
  },
  {
    name: "contact",
    route: "/contact",
    entry: "./pages/contact.tsx",
    title: "Contact blobatar",
    description:
      "How to reach blobatar: issues and pull requests on GitHub, and an email address for security reports, wall removals and anything that should not be public.",
    ogTitle: "Contact blobatar",
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: "Contact blobatar",
        url: absolute("/contact"),
        description: "How to reach blobatar: GitHub issues for bugs and features, and email for security reports and wall removals.",
        about: { "@id": absolute("/#blobatar") },
        author: { "@id": absolute("/#alain") },
      },
    ],
    prerender: async () => {
      const { createElement } = await import("react");
      const { Contact } = await import("./src/Contact");
      return createElement(Contact);
    },
    defer: true,
  },
  {
    name: "privacy",
    route: "/privacy",
    entry: "./pages/privacy.tsx",
    title: "Privacy — what blobatar.dev stores",
    description:
      "blobatar has no accounts and no profiles. What the site, the avatar endpoint and the wall each store, how long, and how to have a placement removed.",
    ogTitle: "Privacy at blobatar.dev",
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "PrivacyPolicy",
        name: "Privacy at blobatar.dev",
        url: absolute("/privacy"),
        description: "What the site, the avatar endpoint and the wall each store, how long they keep it, and how to have a placement removed.",
        about: { "@id": absolute("/#blobatar") },
        author: { "@id": absolute("/#alain") },
      },
    ],
    prerender: async () => {
      const { createElement } = await import("react");
      const { Privacy } = await import("./src/Privacy");
      return createElement(Privacy);
    },
    defer: true,
  },
  /*
   * The 404 document.
   *
   * A manifest page rather than a hand-written file, so that it is bundled,
   * styled, prerendered and typechecked by the same path as every other page —
   * a 404 that broke would be the one page nobody notices is broken.
   *
   * Cloudflare serves it for any path that matches no asset, with a 404
   * status, because `not_found_handling` in `wrangler.jsonc` names it. The
   * route below is what makes the file land at `dist/404.html`, which is the
   * name that setting looks for; that it is also reachable at `/404` is a side
   * effect, and a harmless one.
   *
   * Unindexable, which is load-bearing here rather than tidy: every wrong URL
   * on this domain resolves to this document, and a canonical on it would ask
   * a crawler to index all of them.
   */
  {
    name: "404",
    route: "/404",
    entry: "./pages/404.tsx",
    title: "Not found — blobatar",
    description:
      "No page at this URL. Every page on blobatar.dev, and the three machine-readable files that describe the site and its avatar endpoint.",
    ogTitle: "Not found",
    indexable: false,
    prerender: async () => {
      const { createElement } = await import("react");
      const { NotFound } = await import("./src/NotFound");
      return createElement(NotFound);
    },
    defer: true,
  },
];
