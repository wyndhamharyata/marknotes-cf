/**
 * Worker-specific repository for moderation operations.
 * Targets the MainDO Durable Object via the env-bound stub.
 */
import { getDoStubFromEnv, type EnvWithMainDo } from "../lib/db/do-client";
import type { ModerationInput, ModerationResult } from "../lib/comments/types";

export async function getUnmoderatedComments(
  env: EnvWithMainDo,
  limit: number = 50,
): Promise<ModerationInput[]> {
  return getDoStubFromEnv(env).getUnmoderatedComments(limit);
}

export async function updateModerationStatus(
  env: EnvWithMainDo,
  results: ModerationResult[],
): Promise<void> {
  return getDoStubFromEnv(env).updateModerationStatus(results);
}
