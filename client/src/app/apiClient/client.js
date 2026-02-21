export function normBaseUrl(s) {
  let out = (s || "").trim().replace(/\/+$/, "");
  if (out && !/^https?:\/\//i.test(out)) out = "http://" + out;
  out = out.replace(/^http:\/\/localhost(?=[:\/]|$)/i, "http://127.0.0.1");
  out = out.replace(/^https:\/\/localhost(?=[:\/]|$)/i, "https://127.0.0.1");
  return out;
}

async function safeReadText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
async function safeReadJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function jfetch(url, options = {}) {
  const res = await fetch(url, { cache: "no-store", ...options });
  const data = await safeReadJson(res);
  const text = data === null ? await safeReadText(res) : "";
  if (!res.ok) {
    const hint = text ? ` — ${text.slice(0, 200)}` : "";
    throw new Error(`HTTP ${res.status}${hint}`);
  }
  return data !== null ? data : text;
}

export function apiGetLevels(baseUrl, options) {
  return jfetch(`${baseUrl}/api/levels`, options);
}
export function apiGetLevel(baseUrl, levelId, options) {
  return jfetch(`${baseUrl}/api/levels/${encodeURIComponent(levelId)}`, options);
}
export function apiLeaderboard(baseUrl, levelId, options) {
  return jfetch(`${baseUrl}/api/leaderboard?levelId=${encodeURIComponent(levelId)}`, options);
}

export function apiSessionStart(baseUrl, levelId, options) {
  // ✅ حماية: إذا صار undefined نعرف فورًا من الكونسول بدل ما نرسل request غلط
  if (!levelId) {
    throw new Error("client_bug: apiSessionStart called without levelId");
  }

  const q = encodeURIComponent(levelId);
  return jfetch(`${baseUrl}/api/session/start?levelId=${q}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ levelId }),
    ...options,
  });
}

export function apiSessionStep(baseUrl, sessionId, move /* optional */, options = {}) {
  const body = { sessionId };
  if (move) body.move = move;
  return jfetch(`${baseUrl}/api/session/step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...options,
  });
}

export function apiSaveRun(baseUrl, payload, options) {
  return jfetch(`${baseUrl}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    ...options,
  });
}
