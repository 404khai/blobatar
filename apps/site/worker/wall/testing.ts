import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import type { D1Database, D1PreparedStatement } from "./db";

/**
 * D1, as `bun:sqlite`.
 *
 * Test support, and the reason it is worth its own file: the alternative is a
 * mocked database, and a mock cannot fail the way this feature depends on
 * failing. Every rule the wall has — one cell to one person, one blob per
 * address per day — is a uniqueness constraint rather than a check in
 * application code, so a test that stubs the database out asserts the happy
 * path and nothing else. This runs the real SQL, over the real migrations,
 * against the same engine D1 is.
 *
 * What it does not reproduce is the network: no latency, no subrequest limits,
 * and `batch` is a local transaction rather than a remote one. Those are not
 * what these tests are about.
 */

const MIGRATIONS = new URL("./migrations/", import.meta.url).pathname;

/** The migrations, in the order wrangler would apply them — filename order,
 * which is what `0001_` is for. */
export function migrate(db: Database) {
  for (const file of readdirSync(MIGRATIONS).filter(name => name.endsWith(".sql")).sort()) {
    db.exec(readFileSync(MIGRATIONS + file, "utf8"));
  }
}

/** A prepared statement that has kept hold of its own SQL, so that `batch` can
 * run it synchronously inside a transaction rather than awaiting a promise it
 * would have to unwrap. */
type Bound = D1PreparedStatement & { sql: string; values: unknown[] };

/**
 * A database that answers D1's shape.
 *
 * `bun:sqlite` binds `?1`-style parameters from a positional array, which is
 * the same thing D1's `.bind()` does, so the statements in `db.ts` are the
 * strings that ship rather than a translation of them.
 */
export function testDb(): D1Database & { raw: Database } {
  const db = new Database(":memory:");
  migrate(db);

  const run = (sql: string, values: unknown[]) => db.query(sql).run(...(values as never[]));

  const statement = (sql: string, values: unknown[] = []): Bound => ({
    sql,
    values,
    bind: (...next: unknown[]) => statement(sql, next),
    all: async <T>() => ({ results: db.query(sql).all(...(values as never[])) as T[] }),
    first: async <T>() => (db.query(sql).get(...(values as never[])) as T) ?? null,
    run: async () => ({ meta: { changes: run(sql, values).changes } }),
  });

  return {
    raw: db,
    prepare: (sql: string) => statement(sql),
    /**
     * A transaction, because that is what D1's is — sequential, non-concurrent,
     * and rolled back whole if any statement fails. The write path leans on
     * exactly that: the day's quota is spent before the cell is claimed, and a
     * failure at either end must leave neither.
     */
    batch: async <T>(statements: D1PreparedStatement[]) => {
      const all = statements as Bound[];
      db.transaction(() => {
        for (const each of all) run(each.sql, each.values);
      })();
      return all.map(() => ({ results: [] as T[] }));
    },
  };
}
