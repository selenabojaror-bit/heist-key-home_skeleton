import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson(fileName) {
  const p = path.join(__dirname, fileName);
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw);
}

function sanitizeLevel(lvl) {
  return {
    ...lvl,

    
    cameras: [],

    
    rules: {
      ...(lvl.rules || {}),
      maxAlerts: 0,
      keyRequired: true,
    },
  };
}

const LEVEL_FILES = ["L1.json", "L2.json", "L3.json"];
const LEVELS = LEVEL_FILES.map((f) => sanitizeLevel(readJson(f)));

export function listLevels() {
  return LEVELS.map((l) => ({ id: l.id, name: l.name }));
}

export function getLevelById(id) {
  return LEVELS.find((l) => l.id === id) || null;
}
