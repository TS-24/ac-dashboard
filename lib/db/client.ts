import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "./schema.ts";

const databaseUrl = process.env.DATABASE_URL;

export const sql = databaseUrl ? postgres(databaseUrl, { max: 5 }) : null;
export const db = sql ? drizzle(sql, { schema }) : null;
