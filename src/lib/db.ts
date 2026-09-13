import { ZenStackClient } from "@zenstackhq/orm";
import { PostgresDialect } from "@zenstackhq/orm/dialects/postgres";
import { Pool } from "pg";
import { schema } from "../../zenstack/schema";

// Reuse the client across hot-reloads in dev so we don't exhaust Postgres connections.
const globalForDb = globalThis as unknown as { db?: ReturnType<typeof createClient> };

function createClient() {
  return new ZenStackClient(schema, {
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 5,
      }),
    }),
  });
}

export const db = globalForDb.db ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
