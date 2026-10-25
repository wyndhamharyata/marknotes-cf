// Copies prod MainDO rows into the local dev DO via the Cloudflare API. Needs `npx sst dev` running and the `cf` CLI (`npm i -g cf`).
import { execFileSync } from "node:child_process";

// .env's CF_ACCOUNT_ID is the deprecated name cf warns about; pass the deploy account under the new one.
const { CF_ACCOUNT_ID, ...env } = process.env;
const tables = ["replies", "article_analytics_snapshots"];
const out = execFileSync(
  "cf",
  [
    "durable-objects", "namespaces", "query", "64dbbf74525a49559ae7d8a1fc8f7594",
    "--durable-object-name", "main",
    "--jurisdiction", "none",
    "--queries", JSON.stringify(tables.map((t) => ({ sql: `SELECT * FROM ${t}` }))),
  ],
  { maxBuffer: 256 * 1024 * 1024, env: { ...env, CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_DEFAULT_ACCOUNT_ID } },
);
const { results } = JSON.parse(out);

const res = await fetch("http://localhost:4321/__seed", {
  method: "POST",
  body: JSON.stringify(tables.map((table, i) => ({ table, columns: results[i].columns, rows: results[i].rows }))),
});
console.log(res.status, await res.text(), tables.map((t, i) => `${t}: ${results[i].rows.length}`).join(", "));
