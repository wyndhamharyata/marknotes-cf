import { Filter } from "bad-words";

const filter = new Filter();

filter.removeWords("fork", "master", "slave", "kill", "abort", "execute");

export interface ProfanityCheckResult {
  isProfane: boolean;
  cleanedText: string;
}

export function checkProfanity(text: string): ProfanityCheckResult {
  const isProfane = filter.isProfane(text);
  const cleanedText = filter.clean(text);

  return {
    isProfane,
    cleanedText,
  };
}

export function hasProfanity(text: string): boolean {
  return filter.isProfane(text);
}
