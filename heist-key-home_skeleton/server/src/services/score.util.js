// server/src/services/score.util.js

const W_TIME = 0.7;  // 70% وقت
const W_TICKS = 0.3; // 30% خطوات

// Baselines ثابتة
const LEVEL_BASELINES = {
  L1: { refTimeMs: 9000, optimalSteps: 60 },
  L2: { refTimeMs: 6000, optimalSteps: 52 },
  L3: { refTimeMs: 17000, optimalSteps: 91 },
};

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

// ✅ نفس حساب السكور بالضبط اللي كان بالـleaderboard
export function computeScore(levelId, timeMs, ticks) {
  const base = LEVEL_BASELINES[levelId];
  if (!base) return null;

  const t = Number(timeMs);
  const k = Number(ticks);

  if (!Number.isFinite(t) || t <= 0) return null;
  if (!Number.isFinite(k) || k <= 0) return null;

  const timeGrade = clamp01(base.refTimeMs / t);
  const stepsGrade = clamp01(base.optimalSteps / k);

  const raw = (W_TIME * timeGrade) + (W_TICKS * stepsGrade);
  return Math.round(1000 * clamp01(raw));
}