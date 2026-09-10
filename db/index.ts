import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@/db/schema';

// Falls back to a placeholder so local builds without a real DB don't crash at import time.
const databaseUrl = process.env.DATABASE_URL || 'postgresql://placeholder-url';

// Neon serverless driver instance used by drizzle below.
const sql = neon(databaseUrl);
// Drizzle client, typed against our schema — the single DB entry point for the app.
export const db = drizzle({ client: sql, schema });
export * from '@/db/schema';
