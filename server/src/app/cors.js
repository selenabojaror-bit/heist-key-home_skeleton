import cors from "cors";

export function corsMiddleware(config) {
  const allow = new Set([
    (config.CLIENT_ORIGIN || "").trim(),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);

  return cors({
    origin: (origin, cb) => {
      // requests بدون origin (مثل curl) نسمح
      if (!origin) return cb(null, true);

      if (allow.has(origin)) return cb(null, true);
      return cb(new Error(`CORS_BLOCKED: ${origin}`));
    },
    credentials: false,
  });
}
