/**
 * The 404 document.
 *
 * Cloudflare answered a missing path with a bare 404 and no body at all, which
 * is correct as a status and useless as a response: a person got a blank page,
 * and anything reading this site programmatically got a dead end with nothing
 * to try next. This page is the body — a real 404, with somewhere to go.
 *
 * Written for both readers at once. The links are the ordinary footer, which
 * covers a person who mistyped; the block below names the three
 * machine-readable files by path, because the caller that most often lands
 * here is one that guessed a URL, and the useful thing to hand it is the map
 * rather than an apology.
 *
 * It is `indexable: false` in the manifest, which is what keeps a canonical
 * off it: every wrong URL on this domain resolves here, and a canonical would
 * be an instruction to index all of them as this page.
 */
import { Prose, Section, P, Code, A } from "./components/Prose";
import { ORIGIN } from "../origin";

export function NotFound() {
  return (
    <Prose
      title="Not found"
      lede="There is no page at this URL. The site is small enough to list, so the whole of it is below."
    >
      <Section id="pages" title="Where to look">
        <P>
          The <A href="/">landing page</A> is the introduction and the wall.{" "}
          <A href="/docs">Docs</A> covers the avatar endpoint and the packages,{" "}
          <A href="/editor">the editor</A> tunes one by hand, and{" "}
          <A href="/about">about</A>, <A href="/contact">contact</A> and{" "}
          <A href="/privacy">privacy</A> are what they sound like. Every page on
          the site is linked at the bottom of this one.
        </P>
        <P>
          If you were after an avatar, the route is{" "}
          <A href={`${ORIGIN}/avatar/alain`}>/avatar/&lt;name&gt;</A> — a name
          with a slash in it has to be percent-encoded as %2F, which is the
          usual reason a URL that looks right lands here.
        </P>
      </Section>

      <Section id="machine-readable" title="If you are a program">
        <P>
          Three files describe this site and the endpoint it serves, at fixed
          paths, none of which need JavaScript to read:
        </P>
        <Code>{`${ORIGIN}/sitemap.xml     every indexable page here
${ORIGIN}/llms.txt        the library, in prose, and when to reach for it
${ORIGIN}/openapi.json    the avatar endpoint, as OpenAPI 3.1`}</Code>
        <P>
          The spec is generated from the endpoint's own parser, so its enums are
          the values the endpoint actually accepts. Errors come back as JSON
          when you ask for it with an <code>Accept</code> header, each with a
          stable code and a hint — see <A href="/docs#errors">the docs</A>.
        </P>
      </Section>
    </Prose>
  );
}
