import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

function resolveDbPath(dbPathFromConfig) {
  // نخلي المسار نسبي بالنسبة لـ root تاع server/
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // نحن داخل: server/src/db/sqlite/
  // بدنا نطلع لـ server/ وبعدين نركّب المسار اللي بالـconfig
  const serverRoot = path.resolve(__dirname, "../../../");
  return path.resolve(serverRoot, dbPathFromConfig);
}

export async function openSqlite(config) {
  const filename = resolveDbPath(config.DB_PATH);

  const db = await open({
    filename,
    driver: sqlite3.Database,
  });

  // recommended pragmas
  await db.exec("PRAGMA foreign_keys = ON;");
  await db.exec("PRAGMA journal_mode = WAL;");

  return db;
}
