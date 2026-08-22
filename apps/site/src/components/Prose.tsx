/**
 * The chrome the written pages share: a way back, a title, and the footer.
 *
 * These pages are read rather than used — by a person deciding whether to
 * depend on this, and by an agent deciding whether to recommend it — so they
 * are one narrow column of text and nothing else. No hero, no canvas, no
 * bundle worth deferring.
 *
 * `Section` and `Subsection` exist so that the heading levels come from the
 * structure rather than from whoever is writing the page. A document whose
 * headings step h1 → h2 → h3 is navigable by anything that reads outlines,
 * which includes screen readers and every crawler that builds one.
 */
import type { ReactNode } from "react";
import { SiteFooter } from "./SiteNav";

export function Prose({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
      <a
        href="/"
        className="text-muted hover:text-ink text-sm underline underline-offset-4 transition-colors"
      >
        ← blobatar
      </a>

      <h1 className="mt-10 text-[clamp(2rem,6vw,3.25rem)] leading-[1.05] font-medium tracking-[-0.04em]">
        {title}
      </h1>
      <p className="text-muted mt-5 text-balance leading-relaxed">{lede}</p>

      {children}

      <SiteFooter />
    </main>
  );
}

export function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section className="mt-16">
      {/* An id per section, so that a link can point at an answer rather than
          at a page — which is the difference between a citation and a guess. */}
      <h2
        id={id}
        className="scroll-mt-8 text-2xl leading-tight font-medium tracking-[-0.03em]"
      >
        {title}
      </h2>
      <div className="mt-4 flex flex-col gap-4 leading-relaxed">{children}</div>
    </section>
  );
}

export function Subsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-8">
      <h3 className="text-ink text-base font-medium">{title}</h3>
      <div className="mt-3 flex flex-col gap-3 leading-relaxed">{children}</div>
    </div>
  );
}

/** Body copy. Muted, because on these pages the headings carry the structure. */
export function P({ children }: { children: ReactNode }) {
  return <p className="text-muted leading-relaxed">{children}</p>;
}

/** A block of code, or a URL long enough to want the mono face. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <pre className="border-line bg-raised text-ink overflow-x-auto rounded-lg border p-4 font-mono text-[0.8rem] leading-relaxed">
      {children}
    </pre>
  );
}

export function Inline({ children }: { children: ReactNode }) {
  return <code className="text-ink font-mono text-[0.85em]">{children}</code>;
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="text-ink underline decoration-[color:var(--color-line)] underline-offset-4 transition-colors hover:decoration-current"
    >
      {children}
    </a>
  );
}
