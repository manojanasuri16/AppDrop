import "server-only";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";
import { migrate } from "./migrate";

type DB = LibSQLDatabase<typeof schema>;
const g = globalThis as unknown as { __appdropDb?: DB; __appdropClient?: Client; __appdropReady?: Promise<void> };

function init(): DB {
  const url = process.env.DATABASE_URL ?? "file:./data/appdrop.db";
  if (url.startsWith("file:")) {
    try {
      mkdirSync(dirname(url.slice(5)), { recursive: true });
    } catch {}
  }
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
  g.__appdropClient = client;
  g.__appdropReady = migrate(client);
  return drizzle(client, { schema });
}

export const db: DB = g.__appdropDb ?? (g.__appdropDb = init());

/** Await before first query in a request to guarantee the schema exists. Cheap after first call. */
export function dbReady(): Promise<void> {
  return g.__appdropReady ?? Promise.resolve();
}

export { schema };
