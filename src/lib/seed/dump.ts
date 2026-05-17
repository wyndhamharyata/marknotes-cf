import { getTableColumns, type Table } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import * as schema from "../../do/schema";

type DB = BaseSQLiteDatabase<"sync", unknown, typeof schema>;

export async function dumpSqlImpl(db: DB): Promise<string> {
  const [replies, snapshots] = await Promise.all([
    db.select().from(schema.replies),
    db.select().from(schema.articleAnalyticsSnapshots),
  ]);

  const lines: string[] = [
    "DELETE FROM replies;",
    "DELETE FROM article_analytics_snapshots;",
  ];

  for (const row of replies) lines.push(formatInsert("replies", schema.replies, row));
  for (const row of snapshots)
    lines.push(formatInsert("article_analytics_snapshots", schema.articleAnalyticsSnapshots, row));

  return lines.join("\n") + "\n";
}

function formatInsert(
  tableName: string,
  table: Table,
  row: Record<string, unknown>,
): string {
  // getTableColumns gives the real SQL column names; drizzle's row keys are
  // camelCase TS properties, so we map both sides off the same source.
  const entries = Object.entries(getTableColumns(table)).map(([jsKey, col]) => ({
    jsKey,
    sqlName: (col as { name: string }).name,
  }));
  const sqlCols = entries.map((e) => e.sqlName).join(", ");
  const sqlValues = entries.map((e) => formatValue(row[e.jsKey])).join(", ");
  return `INSERT INTO ${tableName} (${sqlCols}) VALUES (${sqlValues});`;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  return `'${String(v).replace(/'/g, "''")}'`;
}
