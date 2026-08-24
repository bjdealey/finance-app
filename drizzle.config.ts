import { defineConfig } from 'drizzle-kit';

// Only used for `drizzle-kit generate` (schema -> SQL). Applying migrations is done by
// src/server/db/migrate.ts, which selects pglite (dev default) or node-postgres (DATABASE_URL).
export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
});
