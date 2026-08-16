const FACTS = [
  ["~3.3 KB", "gzipped, blob only"],
  ["0", "dependencies"],
  ["6", "silhouettes"],
  ["4.5:1", "contrast, every hue"],
];

export function Close() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-32">
      <div className="border-line grid gap-px border-t sm:grid-cols-4">
        {FACTS.map(([value, label]) => (
          <div key={label} className="py-8">
            <div className="text-3xl tracking-tight">{value}</div>
            <div className="text-muted mt-1 text-xs lowercase">{label}</div>
          </div>
        ))}
      </div>

      <div className="mt-16 flex flex-col items-start gap-6">
        <code className="bg-raised border-line rounded-lg border px-5 py-3.5 font-mono text-sm">
          <span className="text-muted select-none">$ </span>
          bun add blobatar
        </code>

        <a
          href="https://github.com/alain/blobatar"
          className="text-muted hover:text-ink text-sm underline underline-offset-4 transition-colors"
        >
          Source on GitHub
        </a>
      </div>

      <footer className="border-line text-muted mt-32 border-t pt-8 text-xs">
        MIT licensed. Every blobatar on this page was generated in your browser.
      </footer>
    </section>
  );
}
