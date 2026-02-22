import { Router } from "express";
import { getLeaderboard, postRun } from "../controllers/scores.controller.js";

export function scoresRoutes() {
  const router = Router();

  router.get("/leaderboard", getLeaderboard);
  router.post("/runs", postRun);

  return router;
}
