/**
 * A table of people, each with a face.
 *
 * ## Why this one uses static blobatars
 *
 * A table is the case the library's default rendering mode exists for. Every
 * blobatar here is one `<img>` with a data URI, so a hundred rows cost a
 * hundred nodes rather than the twelve-hundred an inline SVG per row would
 * come to, and none of them run an animation while you scroll past. Nothing on
 * this component takes `animate` for that reason. If you want the row you are
 * pointing at to react, that is a job for `PresenceAvatar` in a cell, not for
 * the table.
 *
 * ## Why the face is there at all
 *
 * A user table is a wall of similar strings, and the eye has nothing to catch
 * on: `s.nakamura@` and `s.nakagawa@` are the same shape at a glance. A face
 * per row is the only column that is different for every row without being
 * text, which is what makes "the one I was just looking at" findable on the
 * way back from another tab.
 */
"use client";

import { Blobatar } from "@blobatar/react";
import type { BlobatarOptions } from "blobatar";
import { cn } from "@/lib/utils";

export type User = {
  /**
   * The seed. An id or an email is the better choice over a display name: it
   * is the value that does not change when somebody gets married, and a face
   * that survives a rename is the whole promise being made here.
   */
  id: string;
  name: string;
  email: string;
  role: string;
  /** Free text, styled as a pill. `active`, `invited`, `suspended`, whatever
   *  your product's words are. */
  status?: string;
  /** Already formatted. Dates are a locale decision, not this component's. */
  lastSeen?: string;
};

export type UserTableProps = {
  users: User[];
  /** Read by screen readers ahead of the table, and never shown. */
  caption?: string;
  /**
   * Passed to every face, and spread after this component's own options, so a
   * project that wants circles back or a narrower set of silhouettes says so
   * here rather than editing the cell.
   */
  blobatar?: BlobatarOptions;
  className?: string;
};

/** Right-aligned and muted, so the two trailing columns read as metadata
 *  rather than as two more things to compare row by row. */
const cell = "px-4 py-3 align-middle";

export function UserTable({
  users,
  caption = "Users",
  blobatar,
  className,
}: UserTableProps) {
  return (
    /*
     * The scroller is the wrapper, not the table. A table with its own
     * `overflow-x` cannot round its corners against the border, and on a phone
     * this one is wider than the screen by design: the alternative is a
     * responsive layout that hides the columns somebody opened the page to
     * read.
     */
    <div
      className={cn(
        "bg-card text-card-foreground border-border w-full overflow-x-auto rounded-xl border",
        className,
      )}
    >
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>

        <thead>
          <tr className="border-border text-muted-foreground border-b">
            {/* `scope="col"`, so that a screen reader announces the column
                name with each cell instead of reading a grid of loose values. */}
            <th scope="col" className={cn(cell, "font-medium")}>
              User
            </th>
            <th scope="col" className={cn(cell, "font-medium")}>
              Role
            </th>
            <th scope="col" className={cn(cell, "font-medium")}>
              Status
            </th>
            <th scope="col" className={cn(cell, "text-right font-medium")}>
              Last seen
            </th>
          </tr>
        </thead>

        <tbody>
          {users.map(user => (
            <tr
              key={user.id}
              className="border-border hover:bg-accent border-b transition-colors duration-150 last:border-0"
            >
              <td className={cell}>
                <div className="flex items-center gap-3">
                  {/*
                    `background="squircle"`, and it is the row that asks for it
                    rather than taste. A bare silhouette is a different width in
                    every row, so the names beside them start at ragged offsets
                    and the column stops reading as a column. A backdrop fixes
                    that by giving every face the same box, and a squircle is
                    the one that agrees with the table: the panel around it, its
                    corners and its cells are all rounded rectangles, and a
                    circle in that grid is the only round thing on the page.
                  */}
                  <Blobatar
                    name={user.id}
                    background="squircle"
                    {...blobatar}
                    /* Empty `alt`, deliberately. The name is in the cell right
                       beside it, and a face that announced itself would make
                       every row read its person twice. */
                    alt=""
                    className="size-8 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="truncate">{user.name}</div>
                    <div className="text-muted-foreground truncate text-xs">
                      {user.email}
                    </div>
                  </div>
                </div>
              </td>

              <td className={cn(cell, "text-muted-foreground")}>{user.role}</td>

              <td className={cell}>
                {user.status ? (
                  <span className="border-border text-muted-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                    {user.status}
                  </span>
                ) : null}
              </td>

              <td className={cn(cell, "text-muted-foreground text-right font-mono text-xs")}>
                {user.lastSeen}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
