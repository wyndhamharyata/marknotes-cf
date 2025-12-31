import { createClient, type Client } from "@libsql/client/web";
import { Resource } from "sst";
import { LIBSQL_URL, LIBSQL_AUTH_TOKEN } from "astro:env/server";

let client: Client | null = null;

export function getTursoClient(): Client {
  if (!client) {
    let url : string; 
    let authToken : string;
    try {
      url = Resource.LibsqlUrl.value;
      authToken =  Resource.LibsqlAuthToken.value;
    } catch {
      if (!LIBSQL_URL || !LIBSQL_AUTH_TOKEN) {
          throw new Error("Database credentials not configured");
        }
        url = LIBSQL_URL;
        authToken = LIBSQL_AUTH_TOKEN;
    }

    client = createClient({
      url: url,
      authToken: authToken,
    });
  }
  return client;
}
