// server/src/api/controllers/sessions.controller.js
export function sessionsController() {
  function getSvc(req) {
    const svc = req.app?.locals?.sessionSvc;
    if (!svc) {
      const err = new Error("session_service_not_initialized");
      err.status = 500;
      throw err;
    }
    return svc;
  }

  return {
    start(req, res, next) {
      try {
       const body = req.body || {};
const levelId =
  body.levelId ??
  req.query.levelId ??
  body.id ??
  req.query.id;

if (!levelId) {
  const err = new Error("levelId_required");
  err.status = 400;
  throw err;
}


        const out = getSvc(req).start(String(levelId));
        res.status(201).json(out);
      } catch (e) {
        next(e);
      }
    },

    step(req, res, next) {
      try {
        const { sessionId, move } = req.body || {};
        if (!sessionId) {
          const err = new Error("sessionId_required");
          err.status = 400;
          throw err;
        }

        const mv = move ? String(move).toUpperCase() : undefined;
        const out = getSvc(req).step(String(sessionId), mv);
        res.json(out);
      } catch (e) {
        next(e);
      }
    },
  };
}
