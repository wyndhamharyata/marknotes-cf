import type { APIRoute } from "astro";
import { Resource } from "sst";
import { getTursoClient } from "../../lib/db/turso";
import { getAstroCredentials } from "../../lib/db/credentials";
import { getDoStub } from "../../lib/db/do-client";
import type {
  ReplyImportRow,
  SnapshotImportRow,
} from "../../do/main-do";

const CHUNK = 500;

export const GET: APIRoute = async ({ url }) => {
  let expectedToken = "";
  try {
    expectedToken = (Resource as unknown as { MigrationToken: { value: string } })
      .MigrationToken.value;
  } catch {
    return Response.json(
      { ok: false, error: "MigrationToken not configured" },
      { status: 500 },
    );
  }
  const providedToken = url.searchParams.get("token");
  if (!expectedToken || providedToken !== expectedToken) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const wipe = url.searchParams.get("wipe") === "1";

  const turso = getTursoClient(getAstroCredentials());
  const stub = getDoStub();

  const repliesRes = await turso.execute({
    sql: `
      SELECT id, created_at, updated_at, article_slug, message, alias, parent_id,
             moderation_status, hide_publicity, moderation_reason, last_moderated_at,
             deleted_at
      FROM replies
      ORDER BY id ASC
    `,
    args: [],
  });

  const replies: ReplyImportRow[] = repliesRes.rows.map((row) => ({
    id: Number(row.id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    articleSlug: String(row.article_slug),
    message: String(row.message),
    alias: String(row.alias),
    parentId: row.parent_id === null ? null : Number(row.parent_id),
    moderationStatus: Number(row.moderation_status ?? 0),
    hidePublicity: Number(row.hide_publicity ?? 0),
    moderationReason: row.moderation_reason === null ? null : String(row.moderation_reason),
    lastModeratedAt: row.last_moderated_at === null ? null : String(row.last_moderated_at),
    deletedAt: row.deleted_at === null ? null : String(row.deleted_at),
  }));

  const snapsRes = await turso.execute({
    sql: `
      SELECT id, article_slug, pageviews_24h, visits_24h, pageviews_7d, visits_7d,
             pageviews_30d, visits_30d, web_vitals_json, captured_at, created_at
      FROM article_analytics_snapshots
      ORDER BY id ASC
    `,
    args: [],
  });

  const snapshots: SnapshotImportRow[] = snapsRes.rows.map((row) => ({
    id: Number(row.id),
    articleSlug: String(row.article_slug),
    pageviews24h: Number(row.pageviews_24h ?? 0),
    visits24h: Number(row.visits_24h ?? 0),
    pageviews7d: Number(row.pageviews_7d ?? 0),
    visits7d: Number(row.visits_7d ?? 0),
    pageviews30d: Number(row.pageviews_30d ?? 0),
    visits30d: Number(row.visits_30d ?? 0),
    webVitalsJson: row.web_vitals_json == null ? "{}" : String(row.web_vitals_json),
    capturedAt: Number(row.captured_at),
    createdAt: Number(row.created_at ?? Math.floor(Date.now() / 1000)),
  }));

  let importedReplies = 0;
  let importedSnapshots = 0;
  let firstCallDone = false;

  for (let i = 0; i < replies.length; i += CHUNK) {
    const chunk = replies.slice(i, i + CHUNK);
    const res = await stub.bulkImport({
      wipe: wipe && !firstCallDone,
      replies: chunk,
    });
    importedReplies += res.replies;
    firstCallDone = true;
  }

  // Ensure wipe is honored even if there were no replies to import.
  if (wipe && !firstCallDone) {
    await stub.bulkImport({ wipe: true });
    firstCallDone = true;
  }

  for (let i = 0; i < snapshots.length; i += CHUNK) {
    const chunk = snapshots.slice(i, i + CHUNK);
    const res = await stub.bulkImport({ snapshots: chunk });
    importedSnapshots += res.snapshots;
  }

  const doCounts = await stub.getDebugCounts();

  return Response.json({
    ok: true,
    importedReplies,
    importedSnapshots,
    tursoReplyCount: replies.length,
    tursoSnapshotCount: snapshots.length,
    doCounts,
  });
};
