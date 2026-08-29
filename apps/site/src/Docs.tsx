/**
 * `/docs` — the developer page.
 *
 * The library's documentation is its README, and duplicating it here would be
 * a second copy to keep true; what this page documents is the thing the README
 * does not, which is the endpoint this domain serves. It is also the page an
 * agent is pointed at from every error body, from `llms.txt` and from the
 * OpenAPI spec's `externalDocs`, so it has to answer the questions those
 * callers arrive with: what to call, what it takes, what comes back when it
 * goes wrong, and whether there is an account to sign up for. (There is not.)
 *
 * The parameter table is generated from the same spec the endpoint publishes,
 * which is itself generated from the parser — so a parameter cannot appear in
 * one of the three and be missing from the others. That is the whole reason
 * this page imports across the workspace instead of listing eight rows.
 */
import { IGNORED } from "../../api/src/params";
import { openapi } from "../../api/src/openapi";
import { Prose, Section, Subsection, P, Code, Inline, A } from "./components/Prose";
import { ORIGIN } from "../origin";

type Parameter = {
  name: string;
  in: string;
  required?: boolean;
  description: string;
  schema: Record<string, unknown>;
};

const spec = openapi(ORIGIN) as unknown as {
  paths: Record<string, { get: { parameters: Parameter[] } }>;
};

const PARAMETERS = spec.paths["/avatar/{name}"]!.get.parameters;

/** The schema, as the one line a table cell has room for. */
function accepts({ schema }: Parameter): string {
  const { enum: values, minimum, maximum, maxLength, type } = schema as {
    enum?: string[];
    minimum?: number;
    maximum?: number;
    maxLength?: number;
    type?: string;
  };
  if (values) return values.join(" · ");
  if (minimum !== undefined && maximum !== undefined) return `${minimum}–${maximum}`;
  if (maxLength !== undefined) return `${type}, ≤ ${maxLength} chars`;
  return type ?? "string";
}

function Parameters({ rows }: { rows: Parameter[] }) {
  return (
    // Scrolls inside its own box rather than widening the page: the
    // descriptions are sentences and this is a narrow column on a phone.
    <div className="border-line mt-2 overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="text-muted border-line border-b text-xs lowercase">
          <tr>
            <th className="px-4 py-3 font-normal">parameter</th>
            <th className="px-4 py-3 font-normal">accepts</th>
            <th className="px-4 py-3 font-normal">notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(parameter => (
            <tr key={parameter.name} className="border-line border-b last:border-0 align-top">
              <td className="text-ink px-4 py-3 font-mono text-xs whitespace-nowrap">
                {parameter.name}
              </td>
              <td className="text-muted px-4 py-3 font-mono text-xs">{accepts(parameter)}</td>
              <td className="text-muted px-4 py-3 text-xs leading-relaxed">
                {parameter.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ignored = (parameter: Parameter) => IGNORED.includes(parameter.name);

export function Docs() {
  return (
    <Prose
      title="blobatar for developers"
      lede="Everything blobatar.dev serves that is meant to be called rather than read: the avatar endpoint, its OpenAPI description, the packages, and the terms — no key, no account, no rate limit to negotiate."
    >
      <Section id="when-to-use" title="When to use it">
        <P>
          Reach for blobatar when an application needs a picture of somebody it
          has no picture of: a user who has not uploaded an avatar, a commit
          author, a bot, a team, a repository, a seat in a list. It turns any
          string into a stable geometric face, so the same handle is the same
          creature everywhere it appears, with nothing stored anywhere.
        </P>
        <P>
          Use the <A href="#endpoint">HTTP endpoint</A> when the avatar has to
          be a URL — an <Inline>&lt;img src&gt;</Inline>, an email, a Slack or
          GitHub profile field, an OG image, anything rendered by software you
          do not control. Use the <A href="#packages">packages</A> when you are
          rendering in an app you do own, since generating in-process costs no
          request and no network. Both produce the same blobatar for the same
          name.
        </P>
        <P>
          It is a poor fit for two things. It is not an identicon-compatible
          drop-in — the shapes are its own, so switching from another generator
          changes every existing avatar. And it is not an image host: there is
          no upload, and nothing you send is kept.
        </P>
      </Section>

      <Section id="endpoint" title="The HTTP endpoint">
        <P>
          One route, no authentication, and every response is safe to hotlink
          and to cache.
        </P>
        <Code>{`GET ${ORIGIN}/avatar/<name>`}</Code>
        <P>
          A name is anything that stands for somebody — a username, a display
          name, an email, an id, a Gravatar digest. Names are NFC-normalized,
          trimmed and lowercased before hashing, so{" "}
          <Inline>/avatar/Alain</Inline> and <Inline>/avatar/alain</Inline> are
          one blobatar reached by two URLs; prefer one spelling, because every
          cache in the path treats them as two. A name containing a slash must
          be percent-encoded as <Inline>%2F</Inline>.
        </P>
        <Code>{`curl -s "${ORIGIN}/avatar/alain%40example.com?size=64" > blobatar.svg

<img src="${ORIGIN}/avatar/alain?size=48&background=squircle" alt="" />`}</Code>

        <Subsection title="Parameters">
          <P>All optional, and named as the library names them.</P>
          <Parameters rows={PARAMETERS.filter(parameter => !ignored(parameter))} />
        </Subsection>

        <Subsection title="Replacing Gravatar">
          <P>
            Swap the host and keep the rest of the URL. Gravatar's own
            parameters are accepted so that the move is a host edit and nothing
            more; the ones that select a fallback image do nothing here, since
            every string renders and there is no missing avatar to fall back
            to. Code using <Inline>d=404</Inline> to detect "this person has no
            Gravatar" gets a 200 instead.
          </P>
          <Parameters rows={PARAMETERS.filter(ignored)} />
        </Subsection>

        <Subsection title="Caching and generations">
          <P>
            An unpinned URL is cached for a day and served stale for a month
            while it revalidates. A URL that pins a generation with{" "}
            <Inline>?gen=</Inline> is cached for a year as immutable, because a
            generation is one frozen name-to-blobatar mapping and is never
            retired — it cannot come back different. Responses carry an{" "}
            <Inline>ETag</Inline> you can revalidate with{" "}
            <Inline>If-None-Match</Inline>.
          </P>
          <P>
            New silhouettes arrive as a new generation rather than as a change
            to yours, so pin one if a rendered avatar must never change.
          </P>
        </Subsection>

        <Subsection title="Errors">
          <P>
            A rejected request answers in plain text, which is what an{" "}
            <Inline>&lt;img&gt;</Inline> tag and a terminal want. Ask for JSON
            and the same error arrives as a structured body with a stable{" "}
            <Inline>code</Inline> to branch on and a <Inline>hint</Inline>{" "}
            naming the fix. The full list of codes is enumerated in the{" "}
            <A href="/openapi.json">OpenAPI spec</A>.
          </P>
          <Code>{`$ curl -s -H "Accept: application/json" "${ORIGIN}/avatar/alain?expresion=happy"
{
  "error": {
    "code": "unknown_parameter",
    "message": "unknown parameter \\"expresion\\" — expected one of s, size, …",
    "hint": "Remove the parameter or correct its spelling.",
    "status": 400,
    "documentation": "${ORIGIN}/docs"
  }
}`}</Code>
        </Subsection>

        <Subsection title="Authentication and limits">
          <P>
            There is no API key, no account and no per-caller quota. The
            endpoint is a pure function of its URL served from Cloudflare's
            edge, so the useful thing you can do for both of us is let the
            cache work: send <Inline>If-None-Match</Inline>, keep one spelling
            per name, and pin a generation when you can. If you expect sustained
            heavy traffic, render in-process with the packages or{" "}
            <A href="#self-hosting">deploy your own copy</A> — both are the same
            code and neither needs us.
          </P>
        </Subsection>
      </Section>

      <Section id="packages" title="Packages">
        <P>
          Zero dependencies, ESM, typed. The core renders a string to SVG
          markup; the framework packages are thin components over it and pin the
          core to an exact major, because the two are one release.
        </P>
        <Code>{`bun add blobatar                # the generator, ~4.4 KB gzipped
bun add @blobatar/react         # also /vue, /svelte, /solid, /preact, /react-native
bunx @blobatar/cli alain        # write one to a file`}</Code>
        <Code>{`import { Blobatar } from "@blobatar/react";

<Blobatar name={user.email} size={48} />;`}</Code>
        <P>
          There is a shadcn registry too — it installs a wrapper around shadcn's{" "}
          <Inline>Avatar</Inline> that falls back to a blobatar when a user has
          no profile image.
        </P>
        <Code>{`npx shadcn@latest registry add @blobatar=${ORIGIN}/r/{name}.json
npx shadcn@latest add @blobatar/avatar`}</Code>
        <P>
          The full API — traits, palettes, expressions, animation and what is
          guaranteed to stay stable across versions — is in the{" "}
          <A href="https://github.com/Alain00/blobatar#readme">README</A>, and
          in <A href="/llms.txt">llms.txt</A> if you are a machine.
        </P>
      </Section>

      <Section id="motion" title="Motion, and the eyes">
        <P>
          Animation is opt-in and off by default. With{" "}
          <Inline>blobatar/motion.css</Inline> loaded and an{" "}
          <Inline>animate</Inline> prop set, a blobatar breathes, bobs, blinks
          and glances, all of it seeded from the name so that a grid reads as a
          crowd rather than a drill team. That layer is pure CSS: the browser
          runs it and nothing in JavaScript is involved.
        </P>
        <P>
          One layer is not, and cannot be. A gaze is a function of where the
          pointer is, which no keyframe can know, so it ships as its own entry
          point and its own stylesheet — a page that never imports them pays
          nothing for it.
        </P>
        <Code>{`import { useGaze } from "@blobatar/react/gaze";
import "blobatar/gaze.css";

const { ref, lookAt } = useGaze({ travel: 3, lookAt: "pointer" });
<Blobatar ref={ref} name={user.email} animate="always" size={200} />;

// the option is where it usually looks; the function is where it looks now
lookAt({ x, y });     // a point in client coordinates — a caret, a card
lookAt(el);           // an element: its centre, re-read as the page moves
lookAt("pointer");    // the cursor
lookAt("rest");       // its own centre, held: deliberately not looking
lookAt(null);         // nothing — the idle glance comes back`}</Code>
        <P>
          A separate subpath, so it costs nothing unless you import it — the
          same bargain <Inline>@blobatar/react-native/animated</Inline> makes.
          Every adapter has one, under the shape its framework reaches an
          element with: a hook in React and Preact, a composable that takes your
          template ref in Vue, a ref that <em>is</em> the binding in Solid, an{" "}
          <Inline>{"{@attach}"}</Inline> in Svelte. Anywhere else,{" "}
          <Inline>gaze(svgEl)</Inline> from <Inline>blobatar/gaze</Inline> is the
          same driver without the binding.
        </P>
        <P>
          <Inline>travel</Inline> is the excursion, and it is what opts a
          blobatar in. <Inline>--mo-track-travel</Inline> starts at{" "}
          <Inline>0px</Inline>, so with the stylesheet loaded and the excursion
          set nowhere every face on the page holds still. It is in viewBox units
          — the blobatar is 100 across, so 3 is 3% of the face. Without a
          binding, or for a whole field of them at once, set the property
          instead: it inherits, and it can be made responsive.
        </P>
        <Code>{`.hero .mo-eyes { --mo-track-travel: 3px; }`}</Code>
        <P>
          The idle glance stands down on its own while the gaze is driving, so
          the eyes are never being aimed at two things at once. Nothing attaches
          under <Inline>prefers-reduced-motion</Inline> or without a fine
          pointer, both are watched rather than sampled once, and a settled
          blobatar under a still pointer schedules no frames at all.
        </P>
        <P>
          The blobatar at the top of this site is running it, and{" "}
          <A href="/components#password-field">the password field</A> is a
          worked example: it watches the caret while you type and looks away
          when you reveal what you typed.
        </P>
      </Section>

      <Section id="machine-readable" title="Machine-readable">
        <P>
          Three files, at fixed paths, none of which need JavaScript to read:
        </P>
        <Code>{`${ORIGIN}/openapi.json   the endpoint, as OpenAPI 3.1
${ORIGIN}/llms.txt        the library, as prose
${ORIGIN}/sitemap.xml     every page here`}</Code>
        <P>
          The spec is generated from the endpoint's own parser, so its enums are
          the values the endpoint actually accepts rather than a list somebody
          remembered to update. Every operation carries a unique{" "}
          <Inline>operationId</Inline> and a description, which is what
          function-calling formats read.
        </P>
      </Section>

      <Section id="self-hosting" title="Running your own">
        <P>
          The endpoint is a single Cloudflare Worker with no bindings, no
          storage and nothing account-specific in its configuration, kept that
          way precisely so a fork deploys unchanged. Clone{" "}
          <Inline>apps/api</Inline>, deploy, and it answers on your own
          hostname — including its own <Inline>/openapi.json</Inline>, which
          names your origin rather than this one.
        </P>
        <P>
          It is MIT, and so is everything else here. Questions and bugs go to{" "}
          <A href="/contact">contact</A>.
        </P>
      </Section>
    </Prose>
  );
}
