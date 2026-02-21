// server/src/services/session.service.js
import crypto from "crypto";
import { getLevelById } from "../game/levels/index.js";
import { computeScore } from "./score.util.js";

function makeId() {
  return crypto.randomBytes(12).toString("hex");
}

function safeNum(x, fallback) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function keyRequired(level) {
  return !!(level?.rules?.keyRequired ?? level?.requireKey ?? true);
}

function inside(level, x, y) {
  const w = Number(level?.size?.w ?? level?.w);
  const h = Number(level?.size?.h ?? level?.h);
  return x >= 0 && y >= 0 && x < w && y < h;
}

function wallSet(level) {
  const set = new Set();
  const walls = Array.isArray(level?.walls) ? level.walls : [];
  for (const w of walls) set.add(`${w.x},${w.y}`);
  return set;
}

function isWall(walls, x, y) {
  return walls.has(`${x},${y}`);
}

function moveDelta(move) {
  if (move === "U") return { dx: 0, dy: -1 };
  if (move === "D") return { dx: 0, dy: 1 };
  if (move === "L") return { dx: -1, dy: 0 };
  if (move === "R") return { dx: 1, dy: 0 };
  return { dx: 0, dy: 0 }; // "S" أو undefined
}

function manhattan(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/**
 * lose إذا:
 * - player على نفس مربع guard أو ملاصق له (d <= 1)
 * - أو تقابلوا (swap)
 */
function caughtByGuard(guardsPrev, guardsNow, playerPrev, playerNow) {
  for (const g of guardsPrev) {
    if (manhattan(g.x, g.y, playerNow.x, playerNow.y) <= 1) return true;
  }
  for (const g of guardsNow) {
    if (manhattan(g.x, g.y, playerNow.x, playerNow.y) <= 1) return true;
  }
  for (let i = 0; i < guardsPrev.length; i++) {
    const a = guardsPrev[i];
    const b = guardsNow[i] || a;
    const swap =
      playerNow.x === a.x &&
      playerNow.y === a.y &&
      b.x === playerPrev.x &&
      b.y === playerPrev.y;
    if (swap) return true;
  }
  return false;
}

// ===== Guards =====
function initGuards(level) {
  const guards = Array.isArray(level?.guards) ? level.guards : [];
  return guards.map((g, idx) => {
    const path = Array.isArray(g?.path) ? g.path : [];
    const first = path[0] || { x: safeNum(g?.x, 0), y: safeNum(g?.y, 0) };

    return {
      id: g?.id || `G${idx + 1}`,
      path,
      pathIndex: 0,
      x: safeNum(first.x, 0),
      y: safeNum(first.y, 0),
    };
  });
}

function stepGuardsOnce(state) {
  for (const g of state.guards) {
    if (!g.path || g.path.length === 0) continue;
    g.pathIndex = (g.pathIndex + 1) % g.path.length;
    const next = g.path[g.pathIndex];
    g.x = safeNum(next.x, g.x);
    g.y = safeNum(next.y, g.y);
  }
}


// ===== Session Store (in-memory) =====
export function sessionService(config) {
  const TTL = Number(config?.SESSION_TTL_MS || 30 * 60 * 1000);
  const GUARD_MS = Number(config?.GUARD_MS || 300);

  // ✅ مهم: هذا لازم يضل عايش طول ما السيرفر شغال
  const sessions = new Map();

  function cleanup() {
    const now = Date.now();
    for (const [id, s] of sessions.entries()) {
      if (now - s.lastAt > TTL) sessions.delete(id);
    }
  }

  function makeFrame(s) {
    return {
      player: { ...s.state.player },
      guards: s.state.guards.map((g) => ({ id: g.id, x: g.x, y: g.y })),
      cameras: [],
    };
  }

function makeResult(sessionRec) {
  const state = sessionRec.state;
  const now = Date.now();

  const startedAt = Number(sessionRec.createdAt ?? now);
  const timeMs = Math.max(0, now - startedAt);

  const score = computeScore(sessionRec.levelId, timeMs, state.ticks);

  return {
    ticks: state.ticks,
    alerts: state.alerts,
    score: typeof score === "number" ? score : 0,
    win: !!state.win,
    lose: !!state.lose,
    timeMs,
    timeSec: +(timeMs / 1000).toFixed(2),
  };
}

  function ensureActive(s) {
    return !(s.state.win || s.state.lose);
  }

  // ✅ تحريك الحراس حسب الوقت فقط
  function advanceGuardsByTime(sessionRec, playerPrev, playerNow) {
    const state = sessionRec.state;
    const now = Date.now();

    if (!sessionRec.lastGuardAt) sessionRec.lastGuardAt = now;

    let guardsPrev = state.guards.map((g) => ({ x: g.x, y: g.y }));

    while (now - sessionRec.lastGuardAt >= GUARD_MS) {
      sessionRec.lastGuardAt += GUARD_MS;

      stepGuardsOnce(state);

      const guardsNow = state.guards.map((g) => ({ x: g.x, y: g.y }));

      if (caughtByGuard(guardsPrev, guardsNow, playerPrev, playerNow)) {
        state.lose = true;
        return;
      }

      guardsPrev = guardsNow;

      if (state.win || state.lose) return;
    }
  }

  return {
     getElapsed(sessionId) {
      cleanup();
      const s = sessions.get(sessionId);
      if (!s) {
        const err = new Error("session_not_found");
        err.status = 404;
        throw err;
      }
      const now = Date.now();
      const startedAt = Number(s.createdAt ?? now);
      const timeMs = Math.max(0, now - startedAt);
      return { timeMs, timeSec: +(timeMs / 1000).toFixed(2) };
    },

    start(levelId) {
      cleanup();

      const level = getLevelById(levelId);
      if (!level) {
        const err = new Error("level_not_found");
        err.status = 404;
        throw err;
      }

      const id = makeId();
      const walls = wallSet(level);

      const state = {
        ticks: 0,
        alerts: 0,
        win: false,
        lose: false,
        player: {
          x: level.start.x,
          y: level.start.y,
          hasKey: false,
        },
        guards: initGuards(level),
      };

      const now = Date.now();
      const rec = {
        levelId,
        level,
        walls,
        state,
        createdAt: now,
        lastAt: now,
        lastGuardAt: now,
      };

      sessions.set(id, rec);

      return {
        sessionId: id,
        frame: makeFrame(rec),
        result: makeResult(rec),
      };
    },

    step(sessionId, move) {
      cleanup();

      const s = sessions.get(sessionId);
      if (!s) {
        const err = new Error("session_not_found");
        err.status = 404;
        throw err;
      }

      s.lastAt = Date.now();

      if (!ensureActive(s)) {
        return { frame: makeFrame(s), result: makeResult(s) };
      }

      const isRealMove = typeof move === "string" && move.length > 0;

      // snapshots
      const playerPrev = { x: s.state.player.x, y: s.state.player.y };

      // ✅ عداد ticks فقط لحركات اللاعب (مش للـ ping)
      if (isRealMove) s.state.ticks += 1;

      // 1) Move player (بس إذا في move)
      if (isRealMove) {
        const { dx, dy } = moveDelta(move);
        const nx = s.state.player.x + dx;
        const ny = s.state.player.y + dy;

        if (inside(s.level, nx, ny) && !isWall(s.walls, nx, ny)) {
          const isHome = nx === s.level.home.x && ny === s.level.home.y;
          if (!(isHome && keyRequired(s.level) && !s.state.player.hasKey)) {
            s.state.player.x = nx;
            s.state.player.y = ny;
          }
        }

        // Key pickup
        if (
          !s.state.player.hasKey &&
          s.state.player.x === s.level.key.x &&
          s.state.player.y === s.level.key.y
        ) {
          s.state.player.hasKey = true;
        }
      }

      const playerNow = { x: s.state.player.x, y: s.state.player.y };

      // 2) Move guards by time (fixed 300ms)
      advanceGuardsByTime(s, playerPrev, playerNow);
      if (s.state.lose) return { frame: makeFrame(s), result: makeResult(s) };

      // 3) Win (home)
      const onHome =
        s.state.player.x === s.level.home.x && s.state.player.y === s.level.home.y;

      if (onHome) {
        if (!keyRequired(s.level) || s.state.player.hasKey) {
          s.state.win = true;
        }
      }

      return { frame: makeFrame(s), result: makeResult(s) };
    },
  };
}
