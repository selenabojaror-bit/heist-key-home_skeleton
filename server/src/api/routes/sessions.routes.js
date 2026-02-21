// server/src/api/routes/sessions.routes.js
import { Router } from "express";
import { sessionsController } from "../controllers/sessions.controller.js";

export function sessionsRoutes() {
  const router = Router();
  const ctrl = sessionsController();

  // POST /api/session/start  body: { levelId }
  router.post("/start", ctrl.start);

  // POST /api/session/step   body: { sessionId, move? }
  router.post("/step", ctrl.step);

  return router;
}
