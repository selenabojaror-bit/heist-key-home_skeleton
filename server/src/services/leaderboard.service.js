import { scoresRepo } from "../db/repositories/scores.repo.js";
import { computeScore } from "./score.util.js";


// ✅ مقارنة الأفضلية: score ثم time ثم ticks
function isBetterRun(newRun, oldRow) {
  const ns = newRun.score ?? null;
  const os = oldRow.score ?? null;

  if (os === null && ns !== null) return true;
  if (ns === null && os !== null) return false;
  if (ns !== null && os !== null) {
    if (ns > os) return true;
    if (ns < os) return false;
  }

  const nt = newRun.timeMs ?? null;
  const ot = oldRow.time_ms ?? null;

  if (ot === null && nt !== null) return true;
  if (nt === null && ot !== null) return false;
  if (nt !== null && ot !== null) {
    if (nt < ot) return true;
    if (nt > ot) return false;
  }

  const nk = newRun.ticks ?? null;
  const ok = oldRow.ticks ?? null;

  if (ok === null && nk !== null) return true;
  if (nk === null && ok !== null) return false;
  if (nk !== null && ok !== null) {
    if (nk < ok) return true;
    if (nk > ok) return false;
  }

  return false;
}

export function leaderboardService(db) {
  const repo = scoresRepo(db);

  return {
    async saveRun(payload) {
      const {
        levelId,
        playerName,
        timeMs = null,
        ticks = null,
        alerts = null,
      } = payload;

      if (!levelId || typeof levelId !== "string") {
        const err = new Error("levelId_required");
        err.status = 400;
        throw err;
      }

      const name = (playerName || "").trim();
      if (!name) {
        const err = new Error("playerName_required");
        err.status = 400;
        throw err;
      }

           const t = Number(timeMs);
      const k = Number(ticks);

      if (!Number.isFinite(t) || t <= 0) {
        const err = new Error("timeMs_required");
        err.status = 400;
        throw err;
      }
      if (!Number.isFinite(k) || k <= 0) {
        const err = new Error("ticks_required");
        err.status = 400;
        throw err;
      }

      // ✅ score الحقيقي حسب baseline
      const computedScore = computeScore(levelId, t, k);
      await db.exec("BEGIN IMMEDIATE;");
      try {
        const existing = await repo.getBestByPlayerLevel(levelId, name);

        if (!existing) {
          const id = await repo.insertScore({
            levelId,
            playerName: name,
           timeMs: t,
ticks: k,
            score: computedScore,
            alerts,
          });

          await db.exec("COMMIT;");
          return { id, action: "inserted", score: computedScore };
        }

const newRun = { timeMs: t, ticks: k, score: computedScore, alerts };
        if (isBetterRun(newRun, existing)) {
          const id = await repo.updateScore(existing.id, newRun);

          await db.exec("COMMIT;");
          return { id, action: "updated_best", score: computedScore };
        }

        await db.exec("COMMIT;");
        return {
          id: existing.id,
          action: "ignored_worse",
          score: existing.score ?? null,
        };
      } catch (e) {
        await db.exec("ROLLBACK;");
        throw e;
      }
    },

    async getLeaderboard(levelId, limit = 10) {
      if (!levelId || typeof levelId !== "string") {
        const err = new Error("levelId_required");
        err.status = 400;
        throw err;
      }

      const lim = Number(limit);
      const safeLimit = Number.isFinite(lim) ? Math.max(1, Math.min(50, lim)) : 10;

      return repo.getTopScoresByLevel(levelId, safeLimit);
    },
  };
}