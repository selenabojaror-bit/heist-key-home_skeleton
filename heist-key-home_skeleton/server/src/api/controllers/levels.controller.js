import { listLevels, getLevelById } from "../../game/levels/index.js";

// GET /api/levels
export function getLevels(req, res) {
  res.json(listLevels());
}

// GET /api/levels/:id
export function getLevel(req, res, next) {
  try {
    const id = String(req.params.id || "").trim();
    const level = getLevelById(id);

    if (!level) {
      const err = new Error("level_not_found");
      err.status = 404;
      throw err;
    }

    // رجعة متوافقة مع الفرونت اللي كتبناه قبل: meta + data
    res.json({
      id: level.id,
      name: level.name,
      data: level,
    });
  } catch (err) {
    next(err);
  }
}
