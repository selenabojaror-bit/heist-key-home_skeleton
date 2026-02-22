import { Router } from "express";
import { getLeaderboard, postRun } from "../controllers/scores.controller.js";

export function scoresRoutes() {
  const router = Router();

  // لازم يطابقوا طلبات الـFrontend
  router.get("/leaderboard", getLeaderboard);
  router.post("/runs", postRun);

  return router;
}
