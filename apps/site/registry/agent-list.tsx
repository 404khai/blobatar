/**
 * The agents in a run, as a group inside the sidebar an app already has.
 *
 * ## Why a blobatar and not an icon
 *
 * Agents are spawned, not registered. There is no avatar upload step and no
 * design pass per agent, and the set changes between one run and the next, so
 * whatever identifies them has to be derivable from the only thing they have: a
 * name. Initials collapse ("researcher" and "reviewer" are both R in a 32px
 * circle) and a shared robot glyph identifies nothing at all. A blobatar is a
 * different creature per string, and the same creature every time that string
 * comes back, which is what makes a list of them scannable rather than
 * decorative.
 *
 * ## Why a `SidebarGroup` rather than its own panel
 *
 * This used to be a hand-rolled `<aside>`, which was the wrong shape for the
 * place it goes: an agent runner already has a sidebar, and a second one beside
 * it is chrome duplicated rather than a feature. As a group it drops into
 * whatever the app already has, between the project switcher and the recents,
 * and inherits the things that are properties of the sidebar rather than of
 * this list: the collapse state, the mobile sheet, the keyboard shortcut, the
 * active-row styling. Nothing here reimplements any of them.
 *
 * The corollary is that it must be rendered inside a `SidebarProvider`.
 * `SidebarMenuButton` reads the sidebar's state for its collapsed behaviour, so
 * outside a provider this throws rather than degrading, which is the better of
 * the two failures: it is a component that only makes sense in a sidebar.
 *
 * ## The rows are animated
 *
 * Every face is a `PresenceAvatar`, and those are `animate="always"`: an aside
 * of agents is the one list where "these are running right now" is the whole
 * message, and faces that breathe carry it before any label does. That makes
 * each row an inline SVG rather than an image, which is affordable for a fleet
 * and would not be for a directory. It also needs the library's stylesheet,
 * imported once, anywhere in your app: `import "blobatar/motion.css"`.
 */
"use client";

import type { BlobatarOptions } from "blobatar";
import { PresenceAvatar, type PresenceState } from "@/components/ui/presence-avatar";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export type Agent = {
  /** The seed for the face, and the label, unless `title` says otherwise. */
  name: string;
  /** A friendlier name to show. The face still comes from `name`. */
  title?: string;
  /** Drives the dot, and the thinking indicator. See `PresenceAvatar`. */
  state?: PresenceState;
  /** One line of what it is doing right now. Truncated, never wrapped. */
  status?: string;
  /**
   * The one number worth seeing without opening the agent: elapsed time, a
   * queue depth, a token count. Whatever your runner actually has.
   */
  badge?: string | number;
};

export type AgentListProps = {
  agents: Agent[];
  /** The group heading. */
  label?: string;
  /** `name` of the selected agent, if the surrounding page tracks one. */
  activeName?: string;
  onSelect?: (agent: Agent) => void;
  /**
   * Passed to every face. A house style belongs on the list rather than on each
   * agent: `{ traits: { shape: [0.11, 0.54, 0.99] } }` narrows the roster to
   * three silhouettes, and a list drawn from one set of rules is what makes it
   * read as one fleet.
   */
  blobatar?: BlobatarOptions;
  className?: string;
};

export function AgentList({
  agents,
  label = "Agents",
  activeName,
  onSelect,
  blobatar,
  className,
}: AgentListProps) {
  /*
   * A count in the heading, because the useful question about a fleet is "how
   * many are still going", and that is the one number a list of rows makes you
   * count by hand.
   */
  const working = agents.filter(agent => agent.state === "thinking").length;

  return (
    <SidebarGroup className={className}>
      <SidebarGroupLabel>
        {label}
        <span className="ml-auto font-mono">
          {working}/{agents.length}
        </span>
      </SidebarGroupLabel>

      <SidebarMenu>
        {agents.map(agent => (
          <SidebarMenuItem key={agent.name}>
            {/*
              `size="lg"`, which is the size shadcn's menu button has for
              exactly this row: a face beside two lines. The default is `h-8`
              and would crop both.

              `tooltip` earns its place rather than repeating the label. It is
              shown only when the rail is collapsed to icons, which is the one
              state where the name is not on screen and a face on its own is
              being asked to carry the whole row.
            */}
            <SidebarMenuButton
              size="lg"
              isActive={agent.name === activeName}
              onClick={() => onSelect?.(agent)}
              tooltip={agent.title ?? agent.name}
              // Room for the badge, which is positioned over the row rather
              // than laid out in it. Only when there is one.
              className={cn(agent.badge != null && "pr-8")}
            >
              <PresenceAvatar
                name={agent.name}
                state={agent.state}
                label={agent.title ?? agent.name}
                blobatar={blobatar}
                className="size-9"
              />

              {/*
                `min-w-0` on the text column, and it is load-bearing rather than
                tidy: a flex child defaults to `min-width: auto`, so a long
                status line refuses to shrink and pushes the row wider than the
                sidebar instead of truncating inside it.
              */}
              <div className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm">{agent.title ?? agent.name}</span>
                {agent.status ? (
                  <span className="text-sidebar-foreground/60 truncate text-xs">
                    {agent.status}
                  </span>
                ) : null}
              </div>
            </SidebarMenuButton>

            {agent.badge != null ? (
              <SidebarMenuBadge className="font-mono">{agent.badge}</SidebarMenuBadge>
            ) : null}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
