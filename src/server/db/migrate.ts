import 'dotenv/config';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { db, dbKind, closeDb } from './client';

async function main() {
  console.log(`Applying migrations via ${dbKind}…`);
  const cfg = { migrationsFolder: './drizzle' };
  if (dbKind === 'pglite') await migratePglite(db as never, cfg);
  else await migratePg(db as never, cfg);
  console.log('Migrations applied.');
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
