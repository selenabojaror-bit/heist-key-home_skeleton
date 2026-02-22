export function getConfig() {
  const PORT = Number(process.env.PORT || 4000);

  const CLIENT_ORIGIN =
    (process.env.CLIENT_ORIGIN ||
      process.env.RENDER_EXTERNAL_URL ||
      "http://127.0.0.1:5173").trim();

  const DB_PATH = (process.env.DB_PATH || "./data/app.sqlite").trim();

  // Sessions
  const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 30 * 60 * 1000);

  return {
    PORT,
    CLIENT_ORIGIN,
    DB_PATH,
    SESSION_TTL_MS,
  };
}