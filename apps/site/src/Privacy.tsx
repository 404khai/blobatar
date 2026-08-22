/**
 * `/privacy` — what this site stores, which is very little and not nothing.
 *
 * Written from the code rather than from a template: every claim below is one
 * a reader could check against `worker/wall/` and `mount.tsx`. That is the only
 * kind of privacy page worth publishing for a project whose source is public —
 * a boilerplate one would be checkable too, and wrong.
 *
 * The date is stated rather than generated. A build-stamped "last updated"
 * changes on every deploy and so tells a reader nothing about whether the
 * policy changed, which is the only question the line exists to answer.
 */
import { Prose, Section, Subsection, P, Inline, A } from "./components/Prose";
import { ISSUES, X_HANDLE, X_PROFILE } from "../origin";

const UPDATED = "22 August 2026";

export function Privacy() {
  return (
    <Prose
      title="Privacy"
      lede="blobatar has no accounts, no sign-in and no profiles. Most of this site stores nothing at all; the wall stores what you deliberately leave on it, and this page says exactly what that is."
    >
      <Section id="site" title="Reading the site">
        <P>
          The landing page, this page, the documentation and the editor are
          static files served from Cloudflare's edge. They set no cookies, load
          no third-party scripts, and send nothing anywhere. The editor runs
          entirely in your browser: the blobatar you tune and the code it
          produces never leave the page.
        </P>
        <P>
          Cloudflare Web Analytics is enabled on this domain. Its beacon is
          inserted at the edge rather than bundled into the page, and it counts
          page views without cookies, without fingerprinting and without
          building a profile of a visitor across sites. As the host of this
          site, Cloudflare also processes the ordinary details of a request —
          IP address, user agent, the URL asked for — to serve it and to protect
          against abuse.
        </P>
      </Section>

      <Section id="endpoint" title="The avatar endpoint">
        <P>
          <Inline>/avatar/&lt;name&gt;</Inline> is a pure function of its URL.
          It stores nothing, keeps no log of its own, and reads no cookie —
          rendering is arithmetic over the name, and the response is the whole
          of what happens.
        </P>
        <P>
          Worth knowing anyway: the name is <em>in the URL</em>, so it appears
          wherever URLs appear — the caching layers between you and here, your
          own server logs, the referrer of a page that embeds it. If the value
          that identifies a person is sensitive, an email address most of all,
          hash it before putting it in the path. A digest is a perfectly good
          seed, gets that person the same stable blobatar every time, and is not
          their address.
        </P>
      </Section>

      <Section id="wall" title="The wall">
        <P>
          The wall is the one part of this site that writes anything down.
          Placing a blobatar is a deliberate act, and what it records is:
        </P>

        <Subsection title="What is stored">
          <P>
            The name you typed, the expression you chose, and the cell you
            placed it in. The name is the seed the blobatar is drawn from and it
            is public — it is what makes the wall a wall of somebodies rather
            than of shapes. Do not place a name you would not put on a public
            page.
          </P>
          <P>
            A hash of your IP address, never the address itself. It is hashed
            together with a secret and with the day's date, which is what
            enforces one placement per day and also what makes the row
            unreachable afterwards: tomorrow the same address hashes
            differently, so nothing can join yesterday's rows to today's
            visitor, including us.
          </P>
          <P>
            A hash of a random token stored in a cookie. It grants finding, not
            editing — it is how "find mine" works on a second device or after a
            cleared browser — and no endpoint accepts one and changes anything.
          </P>
        </Subsection>

        <Subsection title="The cookie">
          <P>
            One cookie, named <Inline>wall</Inline>, set only when you place a
            blobatar. It holds that random token and nothing else: it is{" "}
            <Inline>HttpOnly</Inline>, <Inline>Secure</Inline>,{" "}
            <Inline>SameSite=Lax</Inline>, lasts a year, and is functional
            rather than analytical — it identifies a placement, not a person,
            and is never read by anything but the wall. Your browser also keeps
            your own cell in <Inline>localStorage</Inline> so the page can find
            it without a request.
          </P>
        </Subsection>

        <Subsection title="The bot check">
          <P>
            Placing runs a Cloudflare Turnstile challenge, which is what keeps
            the wall from being filled by a script. Cloudflare processes the
            challenge and receives the request details it needs to judge it;
            Turnstile is designed to work without tracking users across sites.
          </P>
        </Subsection>

        <Subsection title="How long it is kept">
          <P>
            A placement stays until it is removed — the wall is meant to
            persist, and a blobatar that vanished after a month would make the
            whole thing a screensaver. The daily quota rows expire by
            construction, as described above. Nothing is sold, shared with
            advertisers, or used to build a profile, because none of it
            identifies anybody to begin with.
          </P>
          <P>
            To have a placement removed, send a link to it or its coordinates
            by direct message to <A href={X_PROFILE}>{X_HANDLE}</A> on X, or
            open an <A href={ISSUES}>issue</A> if it is a moderation call
            anybody could make rather than something about you. Removals are
            manual. See the <A href="/contact">contact page</A> for the routes
            in full.
          </P>
        </Subsection>
      </Section>

      <Section id="elsewhere" title="Links away from here">
        <P>
          Pages here link to GitHub, npm and X. Those are other companies' sites
          with their own privacy policies, and following a link hands them the
          request the way any link does.
        </P>
      </Section>

      <Section id="changes" title="Changes and contact">
        <P>
          This page describes the site as it is deployed today, {UPDATED}. The
          code behind every claim on it is public, so the fastest way to check
          one is to read it. Questions go to the{" "}
          <A href="/contact">contact page</A>, which lists the two routes in: an{" "}
          <A href={ISSUES}>issue</A>, or a direct message to{" "}
          <A href={X_PROFILE}>{X_HANDLE}</A>.
        </P>
      </Section>
    </Prose>
  );
}
