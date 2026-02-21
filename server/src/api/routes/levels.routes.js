import { Router } from "express";
import { getLevels, getLevel } from "../controllers/levels.controller.js";

export function levelsRoutes() {
  const router = Router();

  router.get("/", getLevels);
  router.get("/:id", getLevel);

  return router;
}
