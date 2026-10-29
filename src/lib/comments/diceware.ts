// TypeScript port of github.com/sethvargo/go-diceware/diceware.
// MIT, Seth Vargo. Source: github.com/wyndhamharyata/go-diceware, ts/src/index.ts.

import type { AstroCookies } from "astro";
import { EFF_LARGE_WORDS } from "./diceware-words";

const EFF_LARGE = { digits: 5, words: EFF_LARGE_WORDS };

/** One fair six-sided die, 1..6. */
function rollDie(): number {
  const bytes = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(bytes);
    const n = bytes[0] & 0b111; // crypto/rand.Int masks the low bits the same way
    if (n < 6) return n + 1;
  }
}

/** Picks `count` distinct words, rolling five dice for each one. */
function generateWords(count: number): string[] {
  const words: string[] = [];
  const seen = new Set<string>();

  while (words.length < count) {
    let index = 0;
    for (let i = 0; i < EFF_LARGE.digits; i++) index = index * 6 + rollDie() - 1;

    const word = EFF_LARGE_WORDS[index];
    if (seen.has(word)) continue;

    seen.add(word);
    words.push(word);
  }

  return words;
}

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function generateAlias(): string {
  const [first, second] = generateWords(2);
  return `${toTitleCase(first)} ${toTitleCase(second)}`;
}

const COOKIE_NAME = "comment_alias";
const COOKIE_MAX_AGE = 34560000; // ~400 days

export function getOrCreateAlias(cookies: AstroCookies): string {
  const existing = cookies.get(COOKIE_NAME)?.value;

  if (existing) {
    return decodeURIComponent(existing);
  }

  const newAlias = generateAlias();

  cookies.set(COOKIE_NAME, newAlias, {
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
    secure: import.meta.env.PROD,
    httpOnly: true,
  });

  return newAlias;
}

export function getAliasFromCookie(cookies: AstroCookies): string | null {
  const existing = cookies.get(COOKIE_NAME)?.value;
  return existing ? decodeURIComponent(existing) : null;
}
