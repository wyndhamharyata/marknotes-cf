import { Filter } from "bad-words";

// Configure filter similarly to go-away's lenient settings
// Only catches direct curse words, not aggressive variations
const filter = new Filter();

// Remove tech-specific terms that are common in programming contexts
filter.removeWords("fork", "master", "slave", "kill", "abort", "execute");

export interface ProfanityCheckResult {
  isProfane: boolean;
  cleanedText: string;
}

/**
 * Check if text contains profanity (lenient check - only direct curse words)
 * Mirrors go-away library behavior from the Go implementation
 */
export function checkProfanity(text: string): ProfanityCheckResult {
  const isProfane = filter.isProfane(text);
  const cleanedText = filter.clean(text);

  return {
    isProfane,
    cleanedText,
  };
}

/**
 * Returns true if profanity is detected in the text
 */
export function hasProfanity(text: string): boolean {
  return filter.isProfane(text);
}
