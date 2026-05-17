import type { Config } from "drizzle-kit";

export default {
  schema: "./src/do/schema.ts",
  out: "./src/do/drizzle",
  dialect: "sqlite",
  driver: "durable-sqlite",
} satisfies Config;
