/**
 * The footer every page ends on.
 *
 * One component rather than a list per page, because the reason it exists is
 * that the site's pages were only reachable from each other by way of the
 * landing page's two links — an agent (or a person) landing on `/editor` had
 * no route to the documentation, and nothing at all pointed at `/llms.txt` or
 * the OpenAPI spec, both of which are files a machine can only use if
 * something tells it they are there.
 *
 * Text links rather than a styled nav: this is the bottom of a page about a
 * library, and the pages it points at are prose.
 */
/** Every link in the footer, in order. Exported so `site.test.ts` can check
 * that each internal one still resolves to a page or a generated file — the
 * failure mode of a hand-written nav is a link to something that moved. */
export const SITE_LINKS: [string, string][] = [
  ["/docs", "Docs"],
  ["/components", "Components"],
  ["/editor", "Editor"],
  ["/about", "About"],
  ["/contact", "Contact"],
  ["/privacy", "Privacy"],
  ["https://github.com/Alain00/blobatar", "GitHub"],
  ["https://www.npmjs.com/package/blobatar", "npm"],
  // The two machine-readable descriptions of this site, linked so that
  // something reading the HTML can find them without guessing at well-known
  // paths.
  ["/llms.txt", "llms.txt"],
  ["/openapi.json", "OpenAPI"],
];

const link =
  "text-muted hover:text-ink text-sm underline underline-offset-4 transition-colors";

export function SiteNav({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Site" className={`flex flex-wrap gap-x-6 gap-y-3 ${className}`}>
      {SITE_LINKS.map(([href, label]) => (
        <a key={href} href={href} className={link}>
          {label}
        </a>
      ))}
    </nav>
  );
}

/** The line under it. Same on every page, and true on every page. */
export function SiteFooter({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="border-line mt-24 border-t pt-8">
      <SiteNav />
      <p className="text-muted mt-6 text-xs">
        {children ?? "MIT licensed. blobatar is an open-source project by Alain."}
      </p>
    </footer>
  );
}
