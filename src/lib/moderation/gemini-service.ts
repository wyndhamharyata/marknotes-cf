import { GoogleGenAI, Type } from "@google/genai";
import { Resource } from "sst";
import type { ModerationInput, ModerationResult, ModerationBatchResult } from "../comments/types";

// Moderation prompt - ported from ../marknotes/internal/llm/client.go
const MODERATION_PROMPT = `
Imagine you are content moderator for a blog site revolving around technology and programming.
Your task is to moderate following comments.

'id' is an integer and should return the same id that supplied from the input.

'message' is a string and should return the same message that supplied from the input.

'moderation_status' is an integer, where 1 means "OK", 2 means "Warning", and 3 means "Dangerous".
- OK means all comments that uses normal language, including disagreement and civil debates.
- Warning means it may have strong language, implicit mockery, swearing in context, and any normal message that contains URL.
- Dangerous should cover actual hate speech, slander, slur, ad hominem, straw man fallacy, and spam / unrelated content promotion including placeholder / lipsum texts.

'moderation_reason' is a string that contains single sentence, no more than 15 words summarizing the
reasoning for the moderation status.

Comments will be provided in a JSON format of { "id": integer, "message": string }, and will be attached
right after this message.
`;

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    // @ts-expect-error - GeminiApiKey type will be available after running `sst secret set GeminiApiKey`
    const apiKey = Resource.GeminiApiKey.value;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

/**
 * Moderate a batch of comments using Gemini AI
 * Mirrors the Go implementation's batch processing approach with structured JSON output
 */
export async function moderateComments(
  comments: ModerationInput[],
  maxRetries: number = 3
): Promise<ModerationBatchResult> {
  if (comments.length === 0) {
    return { results: [] };
  }

  const client = getGeminiClient();

  // Format comments for the prompt (same format as Go version)
  const commentsJson = JSON.stringify(comments.map((c) => ({ id: c.id, message: c.message })));

  const fullPrompt = `${MODERATION_PROMPT}\n${commentsJson}`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use structured output schema like the Go version
      const response = await client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: fullPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.INTEGER },
                message: { type: Type.STRING },
                moderation_status: { type: Type.INTEGER },
                moderation_reason: { type: Type.STRING },
              },
              propertyOrdering: ["id", "message", "moderation_status", "moderation_reason"],
            },
          },
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from Gemini");
      }

      // Parse the JSON response (should be clean JSON due to structured output)
      const results: ModerationResult[] = JSON.parse(text);

      // Validate and sanitize results
      for (const result of results) {
        if (
          typeof result.id !== "number" ||
          typeof result.message !== "string" ||
          typeof result.moderation_status !== "number" ||
          typeof result.moderation_reason !== "string"
        ) {
          throw new Error("Invalid response structure from Gemini");
        }

        // Ensure status is valid (1, 2, or 3)
        if (![1, 2, 3].includes(result.moderation_status)) {
          result.moderation_status = 2; // Default to Warning if invalid
        }
      }

      return { results };
    } catch (error) {
      lastError = error as Error;
      console.error(`Gemini API attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  return {
    results: [],
    errors: [`Failed after ${maxRetries} attempts: ${lastError?.message}`],
  };
}
