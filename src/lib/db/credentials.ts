import { Resource } from "sst";
import { LIBSQL_URL, LIBSQL_AUTH_TOKEN } from "astro:env/server";
import type { TursoCredentials } from "./turso";

export function getAstroCredentials(): TursoCredentials {
  try {
    const url = Resource.LibsqlUrl.value;
    const authToken = Resource.LibsqlAuthToken.value;
    return { url, authToken };
  } catch {
    if (!LIBSQL_URL || !LIBSQL_AUTH_TOKEN) {
      throw new Error("Database credentials not configured");
    }
    return { url: LIBSQL_URL, authToken: LIBSQL_AUTH_TOKEN };
  }
}
