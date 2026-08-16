import { CheckIcon, CopyIcon, useCopy } from "@/components/ui/copy";
import { cn } from "@/lib/utils";

/**
 * One regex, five token classes.
 *
 * A real highlighter is a parser and a grammar and ~20 KB, and this page emits
 * the only code it ever renders — a couple of imports and one JSX element,
 * written by the generator two files over. The grammar is known, closed, and
 * small enough to match in one pass.
 *
 * Alternation order is the whole correctness argument: comments and strings
 * come first so that a `//` inside a string, or a keyword inside a comment,
 * is already consumed by the time the later branches are tried.
 */
const TOKEN =
  /(\/\/[^\n]*)|("[^"]*")|\b(import|from)\b|(<\/?[A-Z][A-Za-z0-9]*)|([a-zA-Z][A-Za-z0-9]*)(?==)/g;

const CLASS = [
  "text-muted italic", // comment
  "text-code-str", // string
  "text-code-key", // keyword
  "text-ink", // component tag
  "text-muted", // attribute name
];

function highlight(code: string) {
  const out: React.ReactNode[] = [];
  let last = 0;

  // `exec` in a loop rather than `split`, because the group *index* is what
  // carries the token type and `split` throws that away into a flat array of
  // undefineds.
  TOKEN.lastIndex = 0;
  for (let m = TOKEN.exec(code); m; m = TOKEN.exec(code)) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const g = m.slice(1).findIndex(Boolean);
    out.push(
      <span key={m.index} className={CLASS[g]}>
        {m[g + 1]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  out.push(code.slice(last));

  return out;
}

export function Snippet({ code, className }: { code: string; className?: string }) {
  const { copied, copy } = useCopy(code);

  return (
    <div
      className={cn(
        "bg-raised/60 border-line group relative rounded-2xl border",
        className,
      )}
    >
      <button
        type="button"
        onClick={copy}
        // The label is what changes, not just the icon: "copied" has to reach a
        // screen reader too, and swapping the accessible name is how that gets
        // announced without a live region.
        aria-label={copied ? "Copied" : "Copy code"}
        className={cn(
          "text-muted hover:text-ink hover:bg-line/60 absolute top-3 right-3 rounded-lg p-2",
          "transition-colors duration-150",
          copied && "text-ink",
        )}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>

      <pre className="overflow-x-auto p-5 pr-14 font-mono text-[0.8rem] leading-[1.7]">
        <code>{highlight(code)}</code>
      </pre>
    </div>
  );
}
