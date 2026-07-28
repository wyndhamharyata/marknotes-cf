import { Filter } from "bad-words";

const filter = new Filter();

filter.removeWords("fork", "master", "slave", "kill", "abort", "execute");

export function hasProfanity(text: string): boolean {
  return filter.isProfane(text);
}
