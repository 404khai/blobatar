/**
 * The components the gallery shows, in the order it shows them.
 *
 * One list, three consumers: the sidebar, the sections, and `showcase.test.ts`,
 * which checks each entry against `registry.json`. That last one is the reason
 * this is data rather than four hand-written sections. An item's name is its
 * URL (`blobatar.dev/r/<item>.json`) and it is also the argument in the install
 * command printed under its heading, so a rename that reached one of the two
 * would ship a page telling people to install something that 404s.
 *
 * Kept free of component imports on purpose: the test imports this file, and a
 * test that had to pull in React and the whole adapter to read four strings
 * would be a test that breaks for reasons unrelated to what it checks.
 */

/**
 * A union rather than `string`, so that the page's demo table cannot forget
 * one. `Record<ShowcaseItem, …>` in `Components.tsx` is what turns "added an
 * entry here and nowhere else" into a type error instead of a blank section.
 */
export type ShowcaseItem =
  | "presence-avatar"
  | "agent-list"
  | "user-table"
  | "group-chat";

export type Showcase = {
  /** The registry item name. The URL, the anchor, and the install argument. */
  item: ShowcaseItem;
  title: string;
  /** Why you would reach for this one, in a sentence. */
  blurb: string;
};

/**
 * Ordered smallest first.
 *
 * The presence avatar is the piece the agent list is built out of, so a reader
 * who starts at the top has already met it by the time it turns up inside
 * something else. The chat is last because it is the biggest and the least
 * surprising.
 */
export const SHOWCASE: Showcase[] = [
  {
    item: "presence-avatar",
    title: "Presence avatar",
    blurb:
      "One face, plus the two things a face is usually asked to carry: whether the person is there, and how much is waiting. Every state blinks and breathes; thinking also gets the loading indicator.",
  },
  {
    item: "agent-list",
    title: "Agent list",
    blurb:
      "The aside an agent runner needs. Agents are spawned rather than registered, so there is no avatar to upload and no design pass per agent: the name is all there is, and it is enough.",
  },
  {
    item: "user-table",
    title: "User table",
    blurb:
      "A table of people is a wall of similar strings. A face per row is the one column that differs for every row without being text, which is what makes a row findable on the way back.",
  },
  {
    item: "group-chat",
    title: "Group chat",
    blurb:
      "Names in a thread are read once and then skipped. What actually carries who said what is the left column, and in most products that column is a grey circle with a letter in it.",
  },
];

/** The command under each heading, and in the README. One spelling, here. */
export const addCommand = (item: string) => `npx shadcn@latest add @blobatar/${item}`;

/**
 * What you run once, before any of the above.
 *
 * The namespace is a local alias for the registry URL, so `@blobatar/…` means
 * nothing in a project that has not been told what it points at. Written out
 * rather than derived from `registry.json`: the page cannot read that file at
 * runtime, and `registry.test.ts` pins the two together.
 */
export const REGISTER_COMMAND =
  "npx shadcn@latest registry add @blobatar=https://blobatar.dev/r/{name}.json";
