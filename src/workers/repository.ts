/**
 * Worker-specific repository for moderation operations.
 * Uses SST Resource directly to avoid `astro:env/server` import issues.
 */
import { Resource } from "sst";
import { getTursoClient, type TursoCredentials } from "../lib/db/turso";
import { ModerationStatus } from "../lib/comments/types";
import type { ModerationInput, ModerationResult } from "../lib/comments/types";

function getWorkerCredentials(): TursoCredentials {
  const url = Resource.LibsqlUrl.value;
  const authToken = Resource.LibsqlAuthToken.value;

  if (!url || !authToken) {
    throw new Error("Database credentials not configured via SST secrets");
  }

  return { url, authToken };
}

export async function getUnmoderatedComments(limit: number = 50): Promise<ModerationInput[]> {
  const client = getTursoClient(getWorkerCredentials());

  const result = await client.execute({
    sql: `
      SELECT id, message
      FROM replies
      WHERE last_moderated_at IS NULL
        AND deleted_at IS NULL
        AND moderation_status = ?
      ORDER BY created_at ASC
      LIMIT ?
    `,
    args: [ModerationStatus.UNVERIFIED, limit],
  });

  return result.rows.map((row) => ({
    id: row.id as number,
    message: row.message as string,
  }));
}

export async function updateModerationStatus(results: ModerationResult[]): Promise<void> {
  if (results.length === 0) return;

  const client = getTursoClient(getWorkerCredentials());

  const statements = results.map((result) => ({
    sql: `
      UPDATE replies
      SET moderation_status = ?,
          moderation_reason = ?,
          last_moderated_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `,
    args: [result.moderation_status, result.moderation_reason, result.id],
  }));

  await client.batch(statements, "write");
}
