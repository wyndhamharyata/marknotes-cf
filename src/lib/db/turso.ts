import { createClient, type Client } from "@libsql/client/web";
import { Resource } from "sst";

let client: Client | null = null;

export function getTursoClient(): Client {
  if (!client) {
    client = createClient({
      url: Resource.LibsqlUrl.value,
      authToken: Resource.LibsqlAuthToken.value,
    });
  }
  return client;
}
