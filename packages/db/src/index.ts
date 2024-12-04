/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { createTable } from "./schema/_table";
import * as schema from "./schema/auth";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  conn: postgres.Sql | undefined;
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
const conn = globalForDb.conn ?? postgres(process.env.DATABASE_URL!);

const db = drizzle(conn, { schema });
export { schema, db, createTable };
