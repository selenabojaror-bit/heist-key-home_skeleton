import { leaderboardService } from "../../services/leaderboard.service.js";

function getSvc(req) {
  const db = req.app.locals.db;
  return leaderboardService(db);
}

// GET /api/leaderboard?levelId=L1
export async function getLeaderboard(req, res, next) {
  try {
    const { levelId, limit } = req.query;
    const rows = await getSvc(req).getLeaderboard(String(levelId || ""), limit);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function postRun(req, res, next) {
  try {
    const payload = req.body || {};

    // ✅ لا نثق بوقت جاي من الـClient — السيرفر هو اللي بحسبه من الـsession
    if (payload.sessionId) {
      const sessionSvc = req.app?.locals?.sessionSvc;
      if (sessionSvc?.getElapsed) {
        try {
          const { timeMs, timeSec } = sessionSvc.getElapsed(String(payload.sessionId));
          payload.timeMs = timeMs;
          payload.timeSec = timeSec;
       } catch (e) {
  // لو وصلنا timeMs من الكلاينت كـ fallback، ما نوقف الحفظ
  const t = Number(payload.timeMs);
  if (Number.isFinite(t) && t > 0) {
    // تجاهلي sessionId وخلي saveRun يكمل
  } else {
    const err = new Error("sessionId_invalid");
    err.status = 400;
    throw err;
  }
}
      }
    }

    const out = await getSvc(req).saveRun(payload);
    res.status(201).json(out);
  } catch (err) {
    next(err);
  }
}
