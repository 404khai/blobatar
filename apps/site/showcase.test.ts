/**
 * The gallery, against the registry it advertises.
 *
 * `/components` prints an install command under every heading, and every one of
 * those commands is a URL in disguise: `@blobatar/user-table` resolves to
 * `blobatar.dev/r/user-table.json`, which exists only because `registry.json`
 * says so. The two lists are in different files by necessity — the page cannot
 * read the registry at runtime, for the reason `registry.test.ts` gives about
 * the hero's one-liner — so this is where they are held together.
 *
 * The failure being prevented is quiet: renaming an item builds clean, deploys
 * clean, and produces a page whose every button copies a command that 404s.
 */
import { expect, test, describe } from "bun:test";
import { existsSync } from "node:fs";
import { PAGES } from "./manifest";
import { SHOWCASE, REGISTER_COMMAND, addCommand } from "./src/showcase";
import { SITE_LINKS } from "./src/components/SiteNav";

const registry = await Bun.file(`${import.meta.dir}/registry.json`).json();
const readme = await Bun.file(`${import.meta.dir}/../../README.md`).text();

const items = new Map<string, { files: { path: string; target: string }[] }>(
  registry.items.map((item: { name: string }) => [item.name, item]),
);

describe("the components page", () => {
  test("is a page, at the URL the README points at", () => {
    const page = PAGES.find(page => page.route === "/components");
    expect(page).toBeDefined();
    expect(readme).toContain("https://blobatar.dev/components");
  });

  /**
   * Prerendered, and that is a claim about who the page is for rather than a
   * performance setting. Half of what reads a component gallery is deciding
   * whether to recommend this library, and it does not execute JavaScript. A
   * missing thunk serves it an empty root.
   */
  test("is prerendered, since it is also a page about what exists", () => {
    expect(PAGES.find(page => page.route === "/components")?.prerender).toBeFunction();
  });

  test("is reachable from every other page", () => {
    expect(SITE_LINKS.map(([href]) => href)).toContain("/components");
  });
});

describe("every showcased component", () => {
  test("names an item this registry actually serves", () => {
    for (const { item } of SHOWCASE) expect(items.has(item)).toBe(true);
  });

  test("has its source on disk, at the target the item declares", () => {
    for (const { item } of SHOWCASE) {
      const files = items.get(item)!.files;
      expect(files).toHaveLength(1);
      expect(existsSync(`${import.meta.dir}/${files[0]!.path}`)).toBe(true);
      // The alias shims under `src/components/ui` re-export by this name, and
      // that is what lets the page render the published bytes rather than a
      // copy. A target that moved would leave the shim pointing at nothing.
      expect(files[0]!.target).toBe(`components/ui/${item}.tsx`);
    }
  });

  /**
   * The site renders the sources out of `registry/`, so they resolve their
   * imports against this app as well as against whoever installs them. Two
   * specifiers work in both places by construction: `@blobatar/react`, which is
   * a real package here and a declared dependency there, and `@/components/ui/…`
   * and `@/lib/utils`, which are the consumer's aliases and happen to be this
   * app's as well. Anything else resolves in exactly one of the two, and the
   * one it fails in is somebody else's project.
   */
  test("imports only what resolves on both sides of the copy", async () => {
    const allowed = /^(react|blobatar(\/[\w.-]+)?|@blobatar\/react|@\/(lib|components)\/)/;

    for (const { item } of SHOWCASE) {
      const source = await Bun.file(
        `${import.meta.dir}/${items.get(item)!.files[0]!.path}`,
      ).text();

      for (const [, specifier] of source.matchAll(/from "([^"]+)"/g)) {
        expect(`${item}: ${specifier}`).toBe(
          `${item}: ${allowed.test(specifier!) ? specifier : "an import that only resolves here"}`,
        );
      }
    }
  });

  test("is installable by the command the page prints", () => {
    for (const { item } of SHOWCASE) {
      expect(addCommand(item)).toBe(`npx shadcn@latest add @${registry.name}/${item}`);
      // The README lists the same commands. `registry.test.ts` already requires
      // every item to appear there; this requires it in a form somebody can run.
      expect(readme).toContain(addCommand(item));
    }
  });

  test("is reached through the namespace the page tells you to register", () => {
    expect(REGISTER_COMMAND).toContain(`@${registry.name}=${registry.homepage}/r/{name}.json`);
  });
});

/**
 * The other direction, which is the one that goes stale.
 *
 * An item added to the registry and to no page is a component nobody can find:
 * the only two places it would be announced are this gallery and the README.
 * `avatar` is the deliberate exception — it composes shadcn's own `Avatar`, so
 * demonstrating it would mean installing that component into this app for one
 * section, and the README documents it at length instead.
 */
test("every registry item is on the page, or is the one that cannot be", () => {
  const shown = new Set<string>(SHOWCASE.map(entry => entry.item));
  for (const name of items.keys()) {
    expect(`${name}: ${shown.has(name) || name === "avatar"}`).toBe(`${name}: true`);
  }
});
