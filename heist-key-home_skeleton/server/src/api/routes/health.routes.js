import { Router } from "express";

export function healthRoutes() {
  const router = Router();

  router.get("/", (req, res) => {
    res.json({ ok: true });
  });

  return router;
}
