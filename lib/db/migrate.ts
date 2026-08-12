import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { sql } from "./client.ts";

if (!sql) throw new Error("DATABASE_URL is required to run migrations");

for (const file of (await readdir("./lib/db/migrations")).filter((entry) => entry.endsWith(".sql")).sort()) {
  const migration = await readFile(join("./lib/db/migrations", file), "utf8");
  await sql.unsafe(migration);
}
await sql.end();
