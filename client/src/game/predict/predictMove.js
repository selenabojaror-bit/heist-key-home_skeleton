// client/src/game/predict/predictMove.js

const cache = new WeakMap();

function getIndex(level) {
  if (!level) return null;
  if (cache.has(level)) return cache.get(level);

  const w = Number(level?.size?.w ?? level?.w ?? 0);
  const h = Number(level?.size?.h ?? level?.h ?? 0);

  const walls = new Set();
  const arr = Array.isArray(level?.walls) ? level.walls : [];
  for (const p of arr) walls.add(`${Number(p.x)},${Number(p.y)}`);

  const key = level?.key ? { x: Number(level.key.x), y: Number(level.key.y) } : null;
  const home = level?.home ? { x: Number(level.home.x), y: Number(level.home.y) } : null;

  const keyRequired = !!(level?.rules?.keyRequired ?? level?.requireKey ?? true);

  const idx = { w, h, walls, key, home, keyRequired };
  cache.set(level, idx);
  return idx;
}

function inside(idx, x, y) {
  return x >= 0 && y >= 0 && x < idx.w && y < idx.h;
}

function isWall(idx, x, y) {
  return idx.walls.has(`${x},${y}`);
}

function delta(mv) {
  if (mv === "U") return { dx: 0, dy: -1 };
  if (mv === "D") return { dx: 0, dy: 1 };
  if (mv === "L") return { dx: -1, dy: 0 };
  if (mv === "R") return { dx: 1, dy: 0 };
  return { dx: 0, dy: 0 };
}

export function predictMove(frame, level, mv) {
  const idx = getIndex(level);
  if (!idx || !frame?.player || !mv) return { nextFrame: frame, ok: false };

  const { dx, dy } = delta(mv);
  if (!dx && !dy) return { nextFrame: frame, ok: true };

  const px = Number(frame.player.x);
  const py = Number(frame.player.y);
  const nx = px + dx;
  const ny = py + dy;

  if (!inside(idx, nx, ny)) return { nextFrame: frame, ok: false };
  if (isWall(idx, nx, ny)) return { nextFrame: frame, ok: false };

  const hasKeyNow = !!frame.player.hasKey;

  // ممنوع تفوت البيت بدون مفتاح إذا مطلوب
  if (
    idx.home &&
    nx === idx.home.x &&
    ny === idx.home.y &&
    idx.keyRequired &&
    !hasKeyNow
  ) {
    return { nextFrame: frame, ok: false };
  }

  const nextHasKey = hasKeyNow || (idx.key && nx === idx.key.x && ny === idx.key.y);

  const nextFrame = {
    ...frame,
    player: { ...frame.player, x: nx, y: ny, hasKey: nextHasKey },
  };

  return { nextFrame, ok: true };
}