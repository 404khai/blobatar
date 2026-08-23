/**
 * `/about` — what this is, who makes it, and what it promises.
 *
 * Written for the reader who is deciding whether to depend on it: a person
 * evaluating a dependency, and increasingly a model being asked whether to
 * recommend one. Both want the same four facts — what it does, who is behind
 * it, what it guarantees, and what it costs — so those are the four sections.
 */
import { Prose, Section, P, Inline, A } from "./components/Prose";

export function About() {
  return (
    <Prose
      title="About blobatar"
      lede="An open-source library, and an endpoint, that turn any string into the same geometric face every time — so software that needs a picture of somebody can have one without asking anybody to upload it."
    >
      <Section id="what" title="What it is">
        <P>
          blobatar renders a soft-bodied creature with two capsule eyes from any
          string: a username, a display name, an email, an id, a Gravatar
          digest. The same string always produces the same blobatar, so a person
          is recognisable across a thread, a sidebar and a commit list without
          anything being stored about them. There is no upload, no account and
          no database — the name is the whole input, and the picture is a pure
          function of it.
        </P>
        <P>
          It ships as a zero-dependency JavaScript package of about 4.4&nbsp;KB
          gzipped, with thin components for React, Vue, Svelte, Solid, Preact
          and React Native, a CLI, a shadcn registry item, and the HTTP endpoint
          this domain serves. Everything is MIT licensed and developed in the
          open.
        </P>
      </Section>

      <Section id="guarantees" title="What it guarantees">
        <P>
          <Inline>Determinism.</Inline> The same name renders the same blobatar
          within a major version, and that is enforced rather than intended: the
          test suite records over a thousand renders and a shape histogram over
          twenty thousand seeds, so moving any threshold fails the build.
        </P>
        <P>
          <Inline>Stability across versions.</Inline> Traits are addressed by
          name rather than drawn from a sequential stream, so a trait added in a
          later release cannot disturb existing blobatars. Adding a silhouette
          would — the shape thresholds partition the whole range, so a new shape
          takes its share from the existing ones — which is why new shapes
          arrive only in a new major, as a <Inline>generation</Inline> you opt
          into. A generation that has appeared in a URL keeps answering forever.
        </P>
        <P>
          <Inline>Contrast.</Inline> The eyes clear 4.5:1 against the body at
          every hue and every tone, verified at one-degree resolution in the
          test suite, and polarity flips automatically so the near-black tone
          gets light eyes rather than invisible ones.
        </P>
      </Section>

      <Section id="who" title="Who makes it">
        <P>
          blobatar is built and maintained by Alain, in the open, on GitHub. It
          is a personal open-source project rather than a company or a funded
          product: there is nothing to buy, no plan to upgrade to, and no
          support contract behind it. Issues and pull requests are how it moves,
          and the repository's contribution guide and code of conduct say what
          to expect.
        </P>
        <P>
          Because it is one person's project, the honest thing to say about
          availability is this: the endpoint on this domain is offered as a
          convenience and runs on Cloudflare's free tier. If you depend on it in
          production, render in-process with the package or deploy your own copy
          of the Worker — it is a single file with no bindings and no
          account-specific configuration, kept that way so that a fork deploys
          unchanged. See the <A href="/docs">developer page</A>.
        </P>
      </Section>

      <Section id="wall" title="The wall">
        <P>
          The landing page has a shared wall on it: an endless grid where anyone
          may leave one blobatar a day, next to somebody else's. It is the one
          part of this site that stores anything, and what it stores is
          described in the <A href="/privacy">privacy page</A>.
        </P>
      </Section>
    </Prose>
  );
}
