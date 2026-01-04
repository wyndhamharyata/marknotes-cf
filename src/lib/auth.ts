import { createClient } from "@openauthjs/openauth/client";
import { createSubjects } from "@openauthjs/openauth/subject";
import { object, string, email, optional, pipe } from "valibot";
import type { APIContext, AstroCookies } from "astro";
import { OPEN_AUTH_URL } from "astro:env/server";

export const subjects = createSubjects({
  user: object({
    userID: string(),
    email: pipe(string(), email()),
    oauthID: optional(string()),
  }),
});

export const client = createClient({
  clientID: "marknotes-go",
  issuer: OPEN_AUTH_URL ?? "https://openauth.mwyndham.dev",
});

export function setTokens(ctx: APIContext, access: string, refresh: string) {
  ctx.cookies.set("access_token", access, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 34560000,
  });
  ctx.cookies.set("refresh_token", refresh, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 34560000,
  });
}

export function setTokensFromCookies(
  cookies: AstroCookies,
  access: string,
  refresh: string,
) {
  cookies.set("access_token", access, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 34560000,
  });
  cookies.set("refresh_token", refresh, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 34560000,
  });
}

const ADMIN_OAUTH_ID = "34619560";
const ADMIN_EMAIL = "mwyndham.business@gmail.com";

export function isAdmin(user: App.Locals["user"]): boolean {
  if (!user) return false;
  const { oauthID, email } = user.properties;
  return oauthID === ADMIN_OAUTH_ID && email === ADMIN_EMAIL;
}
