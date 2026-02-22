export function errorHandler(err, req, res, next) {
  const status = Number(err?.status) || 500;

  const message =
    typeof err?.message === "string" && err.message.trim()
      ? err.message.trim()
      : status === 500
      ? "server_error"
      : "bad_request";

  if (status >= 500) {
    console.error("❌ SERVER ERROR:", err);
  } else {
    console.warn("⚠️ REQUEST ERROR:", message);
  }

  res.status(status).json({ error: message });
}
