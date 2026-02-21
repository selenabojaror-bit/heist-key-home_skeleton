import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

export async function runMigrations(db) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const sqlPath = path.resolve(__dirname, "./migrations/001_init.sql");
  const sql = await fs.readFile(sqlPath, "utf-8");
  await db.exec(sql);
}
