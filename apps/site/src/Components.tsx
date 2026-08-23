/**
 * `/components` — the things you can build out of a blobatar, each one
 * installable.
 *
 * ## What this page is for
 *
 * The landing page argues that deterministic faces are a good idea and the
 * editor lets you tune one. Neither answers the question somebody asks next,
 * which is what an avatar is actually *for*: a row in a list, a cell in a
 * table, a badge with an unread count on it. This page is those answers, and
 * each one ships as a shadcn registry item rather than as a screenshot.
 *
 * ## The demos are the published sources
 *
 * Every component below is imported from `@/components/ui/…`, which in this app
 * re-exports `registry/…`: the exact bytes `shadcn add` copies into a project.
 * Nothing here is a prettier re-implementation for the gallery. See the comment
 * in `src/components/ui/presence-avatar.tsx`, and the token aliases in
 * `styles.css` that let items written in shadcn's vocabulary render against
 * this site's palette.
 */
import { useEffect, useState, type ReactNode } from "react";
import type { BlobatarOptions } from "blobatar";
import { AgentList, type Agent } from "@/components/ui/agent-list";
import { Sidebar, SidebarContent, SidebarProvider } from "@/components/ui/sidebar";
import { GroupChat, type ChatMessage } from "@/components/ui/group-chat";
import { Install } from "@/components/ui/install";
import { PresenceAvatar, type PresenceState } from "@/components/ui/presence-avatar";
import { UserTable, type User } from "@/components/ui/user-table";
import { SiteFooter } from "@/components/SiteNav";
import { useNearViewport } from "@/lib/near-viewport";
import { cn } from "@/lib/utils";
import { REGISTER_COMMAND, SHOWCASE, addCommand, type ShowcaseItem } from "@/showcase";

/**
 * The demo for each item.
 *
 * Typed as a total record over the union, which is the whole reason
 * `ShowcaseItem` is a union: adding an entry to `SHOWCASE` and forgetting it
 * here is a type error rather than a section that renders nothing.
 */
const DEMOS: Record<ShowcaseItem, () => ReactNode> = {
  "presence-avatar": PresenceAvatarDemo,
  "agent-list": AgentListDemo,
  "user-table": UserTableDemo,
  "group-chat": GroupChatDemo,
};

export function Components() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <a
        href="/"
        className="text-muted hover:text-ink text-sm underline underline-offset-4 transition-colors"
      >
        ← blobatar
      </a>

      <h1 className="mt-10 text-[clamp(2rem,6vw,3.25rem)] leading-[1.05] font-medium tracking-[-0.04em]">
        Components
      </h1>
      <p className="text-muted mt-5 max-w-2xl text-balance leading-relaxed">
        Four pieces of interface built on blobatar, each one a shadcn registry
        item. The generator stays in the packages, so the faces keep their
        guarantee; what gets copied into your project is the composition, which
        is the part you will want to edit.
      </p>

      {/*
        Register the namespace once, then add items by name. Both commands are
        on the page because the second one fails with a confusing error if you
        skipped the first, and the error does not tell you that.
      */}
      <div className="mt-8 flex flex-col gap-3">
        <Install command={REGISTER_COMMAND} className="max-w-full" />
        <p className="text-muted text-xs">
          Once, per project. After that every command below works by name.
        </p>
      </div>

      {/*
        The sidebar is a real column at `lg` and a horizontal strip below it. It
        is not a drawer: four links do not earn a control that has to be opened,
        and a strip that scrolls sideways says "there is a list here" at a
        glance where a hamburger does not.
      */}
      <div className="mt-16 grid gap-12 lg:grid-cols-[13rem_1fr] lg:gap-16">
        <ShowcaseNav />

        <div className="flex min-w-0 flex-col gap-24">
          {SHOWCASE.map(entry => (
            <ShowcaseSection key={entry.item} {...entry} />
          ))}
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}

/**
 * Which section is on screen, for the sidebar to mark.
 *
 * `IntersectionObserver` over the sections rather than a scroll handler doing
 * arithmetic on `getBoundingClientRect`: the observer runs off the main thread
 * and fires only on a crossing, where the handler runs on every frame of every
 * scroll to answer the same question.
 *
 * The band is the top ~30% of the viewport. A section counts as current when
 * its heading is up there, which is where a reader's eye is, rather than when
 * any part of it is visible: with a full-height root three sections intersect
 * at once on a tall screen and the highlight has to guess between them.
 *
 * Returns `undefined` before the observer has ever fired, and during the
 * prerender, where there is no observer at all. The nav renders unmarked in
 * that state, which is correct: nothing has been scrolled to yet.
 */
function useActiveSection(ids: string[]): string | undefined {
  const [active, setActive] = useState<string>();

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) seen.add(entry.target.id);
          else seen.delete(entry.target.id);
        }
        // The first in document order, so that scrolling up through two
        // sections in the band lands on the one above rather than flickering
        // between them.
        setActive(current => ids.find(id => seen.has(id)) ?? current);
      },
      { rootMargin: "0px 0px -70% 0px" },
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids.join()]);

  return active;
}

function ShowcaseNav() {
  const active = useActiveSection(SHOWCASE.map(entry => entry.item));

  return (
    <aside className="lg:sticky lg:top-16 lg:self-start">
      <nav aria-label="Components">
        {/*
          `-mx-6 px-6` on the strip: the scroller has to reach the edges of the
          screen or the first and last items look clipped by a margin, while the
          items themselves stay on the page's gutter. Neither applies once the
          grid gives it a column of its own.
        */}
        <ul className="-mx-6 flex gap-1 overflow-x-auto px-6 lg:mx-0 lg:flex-col lg:px-0">
          {SHOWCASE.map(entry => (
            <li key={entry.item} className="shrink-0">
              <a
                href={`#${entry.item}`}
                // `aria-current="location"` rather than `"page"`: these are
                // places within one page, and `page` would claim the link
                // leads somewhere it does not.
                aria-current={active === entry.item ? "location" : undefined}
                className={cn(
                  "block rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors duration-150",
                  active === entry.item
                    ? "text-ink bg-raised"
                    : "text-muted hover:text-ink",
                )}
              >
                {entry.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function ShowcaseSection({
  item,
  title,
  blurb,
}: {
  item: ShowcaseItem;
  title: string;
  blurb: string;
}) {
  const Demo = DEMOS[item];

  /*
   * The demos wait for the scroll, the words do not.
   *
   * This page is prerendered, so every heading, blurb and install command is in
   * the HTML for whoever does not run JavaScript. The demos are not: four of
   * them come to around forty blobatars, and the two costs of putting that in
   * the document are the same two the landing page's wall taught. A bigger
   * document delays the first paint it was supposed to help, and everything
   * rendered on mount lands inside the window Total Blocking Time measures.
   * See `useNearViewport`.
   *
   * No `defer-offscreen` here, unlike the sections on the landing page. That
   * utility is `content-visibility: auto` with a guessed intrinsic height, and
   * every link in this page's sidebar is an anchor: jumping to `#group-chat`
   * resolves against offsets that are estimates until the browser has measured
   * the sections above it, which lands you near the heading rather than on it.
   * The demos already cost nothing before the scroll, so the utility would be
   * trading the one thing this page's navigation depends on for very little.
   */
  const [ref, near] = useNearViewport<HTMLElement>();

  return (
    <section ref={ref} id={item} className="scroll-mt-8">
      <h2 className="text-2xl leading-tight font-medium tracking-[-0.03em]">{title}</h2>
      <p className="text-muted mt-3 max-w-2xl text-balance leading-relaxed">{blurb}</p>

      <Install command={addCommand(item)} className="mt-5" />

      {/*
        A frame around the demo, in `ground` rather than `raised`. The components
        set their own `bg-card`, and a card on a card is two panels arguing about
        which one is the surface.
      */}
      <div className="border-line mt-6 rounded-2xl border p-6 sm:p-10">
        {near ? (
          <Demo />
        ) : (
          // Roughly the height the demo will take, so the swap happens inside a
          // box that is already the right size instead of growing the page under
          // whatever the reader is looking at.
          <div className="h-64" aria-hidden="true" />
        )}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
 * The demo data.
 *
 * Handles rather than Full Names throughout, and they are chosen rather than
 * typed at random: a page whose claim is "you can tell these people apart"
 * cannot open with four seeds that all landed on pale blue. Same reason the
 * landing page's chat picks its four.
 * ------------------------------------------------------------------------ */

/**
 * The house style every demo on this page is drawn in: three silhouettes
 * rather than ten.
 *
 * A list of positions narrows the shape axis to what it names and lets each
 * name pick among them, so these faces are as per-seed as any other blobatar,
 * read against a shorter list. See `TraitOverrides` in the library.
 *
 * Worth showing here rather than only in the editor, because narrowing is what
 * a product with an existing visual language actually asks for. It is also
 * what makes this page hold together: four demos of the same product, drawn
 * from one set of rules, rather than four screenshots of four applications
 * that happen to use the same library. With all ten silhouettes in play a
 * thread reads as a set of unrelated creatures; with three it reads as one
 * family. The positions are the midpoints of the bands, which is what
 * `src/shapes.ts` exists to keep honest.
 *
 * Passed rather than baked in: none of the four components has an opinion
 * about which silhouettes belong in your product, they just forward whatever
 * this is to every face they draw.
 */
const HOUSE: BlobatarOptions = {
  traits: { shape: [0.11, 0.54, 0.99] }, // round, boxy, triangle
};

function PresenceAvatarDemo() {
  /* Annotated rather than `as const`: an inferred tuple of five differently
     shaped literals has no common `unread`, so reading one off an element of
     the array stops type-checking for the three that omit it. */
  const STATES: { name: string; state: PresenceState; unread?: number; label: string }[] = [
    { name: "laura", state: "online", label: "online" },
    { name: "ivan", state: "online", unread: 3, label: "online, 3 unread" },
    { name: "svea", state: "thinking", label: "thinking" },
    { name: "tobias", state: "away", label: "away" },
    { name: "noor", state: "offline", unread: 128, label: "offline, 128 unread" },
  ];

  return (
    <div className="flex flex-wrap items-start justify-center gap-8 sm:gap-12">
      {STATES.map(({ name, state, unread, label }) => (
        // `gap-4` rather than `gap-3`: the thinking state hangs its indicator
        // below the avatar's box, and a tighter column puts it in the caption.
        <div key={name} className="flex w-20 flex-col items-center gap-4 text-center">
          <PresenceAvatar
            name={name}
            state={state}
            unread={unread}
            blobatar={HOUSE}
            className="size-12"
          />
          {/* The state under the face, because the whole point of this row is
              to show what each state looks like, and a colour is not a label. */}
          <span className="text-muted text-xs leading-tight">{label}</span>
        </div>
      ))}
    </div>
  );
}

function AgentListDemo() {
  const AGENTS: Agent[] = [
    { name: "scout", state: "thinking", status: "reading 41 files", badge: "1m" },
    { name: "planner", state: "thinking", status: "drafting the migration", badge: "12s" },
    { name: "reviewer", state: "online", status: "waiting for a diff" },
    { name: "packager", state: "away", status: "last ran 6m ago" },
    { name: "publisher", state: "offline", status: "not started" },
  ];

  /*
   * A real sidebar around it, because the component is a `SidebarGroup` and a
   * group on its own is half a thing. Two arguments make this a demo rather
   * than an app shell:
   *
   * `collapsible="none"` is the one mode where shadcn's `Sidebar` is a plain
   * flex column instead of a fixed, full-height rail, which is the difference
   * between a panel inside this card and a panel over the whole page.
   *
   * The provider is still real, and has to be: `SidebarMenuButton` reads its
   * state, and its tooltips come from the `TooltipProvider` inside it. Its
   * wrapper is `min-h-svh w-full` by default, sized for a page rather than a
   * preview, so both are overridden here.
   */
  return (
    <SidebarProvider className="min-h-0 w-auto justify-center">
      <Sidebar
        collapsible="none"
        className="border-line h-auto w-64 rounded-xl border py-2"
      >
        <SidebarContent>
          <AgentList agents={AGENTS} activeName="planner" blobatar={HOUSE} />
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}

function UserTableDemo() {
  const USERS: User[] = [
    {
      id: "l.brandt@example.com",
      name: "Laura Brandt",
      email: "l.brandt@example.com",
      role: "Owner",
      status: "active",
      lastSeen: "2m ago",
    },
    {
      id: "t.okonkwo@example.com",
      name: "Tobias Okonkwo",
      email: "t.okonkwo@example.com",
      role: "Admin",
      status: "active",
      lastSeen: "1h ago",
    },
    {
      id: "s.nakamura@example.com",
      name: "Svea Nakamura",
      email: "s.nakamura@example.com",
      role: "Developer",
      status: "active",
      lastSeen: "yesterday",
    },
    // Two addresses four characters apart, on purpose: this is the row pair the
    // component's header comment is about, and the faces are the only thing on
    // the line that tells them apart at a glance.
    {
      id: "s.nakagawa@example.com",
      name: "Sora Nakagawa",
      email: "s.nakagawa@example.com",
      role: "Developer",
      status: "invited",
      lastSeen: "never",
    },
    {
      id: "i.petrov@example.com",
      name: "Ivan Petrov",
      email: "i.petrov@example.com",
      role: "Billing",
      status: "suspended",
      lastSeen: "3 weeks ago",
    },
  ];

  return <UserTable users={USERS} caption="Workspace members" blobatar={HOUSE} />;
}

function GroupChatDemo() {
  const MESSAGES: ChatMessage[] = [
    { name: "laura", text: "avatars are live, every account has one", time: "9:41" },
    { name: "laura", text: "no uploads, no grey initials", time: "9:41" },
    { name: "tobias", text: "generated from the username?", time: "9:42" },
    {
      name: "svea",
      text: "same string, same face, forever. mine has looked like this since I signed up",
      time: "9:43",
    },
    { name: "ivan", text: "so staging me and prod me are different people 😅", time: "9:43" },
    { name: "svea", text: "different string, different person. that is the trick", time: "9:44" },
  ];

  return (
    <GroupChat
      channel="release"
      members={["laura", "tobias", "svea", "ivan"]}
      extra={12}
      messages={MESSAGES}
      typing="tobias"
      blobatar={HOUSE}
    />
  );
}
