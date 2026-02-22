// server/src/app/app.js
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { getConfig } from "./config.js";
import { corsMiddleware } from "./cors.js";

import { openSqlite } from "../db/sqlite/connection.js";
import { runMigrations } from "../db/migrate.js";

import { healthRoutes } from "../api/routes/health.routes.js";
import { levelsRoutes } from "../api/routes/levels.routes.js";
import { sessionsRoutes } from "../api/routes/sessions.routes.js";
import { scoresRoutes } from "../api/routes/scores.routes.js";

import { errorHandler } from "../api/middleware/errorHandler.js";

// ✅ NEW:
import { sessionService } from "../services/session.service.js";

export async function createApp() {
  const config = getConfig();
  const app = express();
  app.set("etag", false);

  app.use(helmet());
  app.use(morgan("dev"));
  app.use(express.json({ limit: "1mb" }));
  app.use(corsMiddleware(config));

  app.locals.config = config;

  // ✅ NEW: one singleton service for all requests
  app.locals.sessionSvc = sessionService({
    ...config,
    GUARD_MS: 300, // ✅ 
  });

  const db = await openSqlite(config);
  await runMigrations(db);
  app.locals.db = db;

  app.use("/api/health", healthRoutes());
  app.use("/api/levels", levelsRoutes());
  app.use("/api/session", sessionsRoutes());
  app.use("/api", scoresRoutes());

  // ✅ Serve client build (Vite dist) when available (Render / production)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const clientDist = path.resolve(__dirname, "../../../client/dist");

  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // SPA fallback (avoid /api)
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      return res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use((req, res) => res.status(404).json({ error: "not_found" }));
  app.use(errorHandler);

  return app;
}