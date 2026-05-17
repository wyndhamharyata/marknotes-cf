/// <reference types="@cloudflare/workers-types" />
import { moderateComments } from "../lib/moderation/gemini-service";
import { getDoStubFromEnv, type EnvWithMainDo } from "../lib/db/do-client";
import type { ModerationInput } from "../lib/comments/types";

const handler: ExportedHandler<EnvWithMainDo> = {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runModeration(env));
  },
};

export default handler;

async function runModeration(env: EnvWithMainDo): Promise<void> {
  console.log("Starting AI moderation job...");

  try {
    const stub = getDoStubFromEnv(env);
    const comments = await stub.getUnmoderatedComments(50);

    if (comments.length === 0) {
      console.log("No comments to moderate");
      return;
    }

    console.log(`Found ${comments.length} comments to moderate`);

    const BATCH_SIZE = 10;
    const batches: ModerationInput[][] = [];

    for (let i = 0; i < comments.length; i += BATCH_SIZE) {
      batches.push(comments.slice(i, i + BATCH_SIZE));
    }

    let totalProcessed = 0;

    for (const batch of batches) {
      const { results, errors } = await moderateComments(batch);

      if (errors && errors.length > 0) {
        console.error("Moderation errors:", errors);
        continue;
      }

      if (results.length > 0) {
        await stub.updateModerationStatus(results);
        totalProcessed += results.length;
      }

      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`Moderation job completed: ${totalProcessed} processed`);
  } catch (error) {
    console.error("Moderation job failed:", error);
    throw error;
  }
}
