#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, "..", "migrations");

const url = process.env.LIBSQL_URL;
const authToken = process.env.LIBSQL_AUTH_TOKEN;

if (!url || !authToken) {
  console.error(
    "LIBSQL_URL and LIBSQL_AUTH_TOKEN must be set. " +
      "Try: node --env-file=.env scripts/migrate.mjs",
  );
  process.exit(1);
}

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.log(`No .sql files in ${migrationsDir}`);
  process.exit(0);
}

const client = createClient({ url, authToken });

console.log(`Target: ${url}`);
console.log(`Applying ${files.length} migration file(s)...`);

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), "utf8");
  try {
    await client.executeMultiple(sql);
    console.log(`  ✓ ${file}`);
  } catch (err) {
    console.error(`  ✗ ${file}: ${err.message}`);
    process.exit(1);
  }
}

console.log("Migrations applied.");
