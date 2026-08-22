/**
 * `/contact` — the routes in, and which one to take.
 *
 * A page of links rather than a form, because there is no inbox behind a form
 * here and pretending otherwise is worse than saying so.
 *
 * No email address, deliberately, and it is worth writing down why rather than
 * leaving the omission to look like an oversight: this is a library with one
 * developer, and the two routes below already reach him. Publishing a personal
 * address here would add nothing a GitHub issue does not do better — issues
 * are searchable, so the next person with the same question finds the answer —
 * while putting that address in front of every harvester that reads a page
 * looking for one.
 */
import { Prose, Section, P, A } from "./components/Prose";
import { ISSUES, NPM, REPO, X_HANDLE, X_PROFILE } from "../origin";

export function Contact() {
  return (
    <Prose
      title="Contact"
      lede="blobatar is a library maintained by one developer, so the fastest route in is the repository — and for the things that should not be public first, a direct message."
    >
      <Section id="issues" title="Bugs, questions and feature requests">
        <P>
          Open an issue at <A href={ISSUES}>github.com/Alain00/blobatar/issues</A>.
          That is the right place for anything about the library or the
          endpoint: a blobatar that renders wrong, a parameter that behaves
          unexpectedly, a framework adapter you want, a question the README did
          not answer. Include the name you rendered and the version or the full
          URL — every blobatar is reproducible from those, which is usually the
          whole of a diagnosis.
        </P>
        <P>
          Pull requests are welcome and the contribution guide in the repository
          says what the tests expect. Discussion of anything larger than a fix
          is better as an issue first, since the shape roster and the trait
          ranges are frozen per major and a change to either lands in a
          different release than a bug fix would.
        </P>
      </Section>

      <Section id="private" title="Security reports and anything not public">
        <P>
          For a security issue, use GitHub's private vulnerability reporting on
          the <A href={`${REPO}/security/advisories/new`}>repository's security
          tab</A>. It reaches the maintainer without the report being visible to
          anybody else, which a public issue would not. A description of what an
          attacker can do, and how you found it, is enough to start with —
          please do not open a public issue first.
        </P>
        <P>
          For anything else that should not be public — a request to remove
          something somebody left on the wall, a licensing or attribution
          question, press — send a direct message to{" "}
          <A href={X_PROFILE}>{X_HANDLE}</A> on X. There is one person reading,
          so a reply may take a few days.
        </P>
      </Section>

      <Section id="wall-removals" title="Removing something from the wall">
        <P>
          Every blobatar on the wall was placed with a name somebody typed, and
          those names are public. If one is yours and you want it gone, or if
          one is abusive, send the coordinates or a link to it by either route
          above — a direct message if it is about you, an issue if it is a
          moderation call anybody could make. Removals are manual and are not a
          refund: the day's placement is still spent.
        </P>
      </Section>

      <Section id="elsewhere" title="Elsewhere">
        <P>
          The packages are on <A href={NPM}>npm</A>, the source is on{" "}
          <A href={REPO}>GitHub</A>, and the developer behind it is{" "}
          <A href={X_PROFILE}>{X_HANDLE}</A>. There is no support desk, no
          chat, no phone number and no published email — the honest state of a
          library this size rather than an omission.
        </P>
      </Section>
    </Prose>
  );
}
