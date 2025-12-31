import { createClient, type Client } from "@libsql/client/web";

export interface TursoCredentials {
  url: string;
  authToken: string;
}

let client: Client | null = null;
let currentUrl: string | null = null;

export function getTursoClient(credentials: TursoCredentials): Client {
  if (!client || currentUrl !== credentials.url) {
    client = createClient({
      url: credentials.url,
      authToken: credentials.authToken,
    });
    currentUrl = credentials.url;
  }
  return client;
}
