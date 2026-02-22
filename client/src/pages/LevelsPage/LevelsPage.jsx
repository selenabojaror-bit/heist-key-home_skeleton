import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LevelsPage.css";

const LS_BACKEND = "heist_backend_url";
const LS_PLAYER = "heist_player_name";

function normUrl(url) {
  let out = (url || "").trim().replace(/\/+$/, "");
  if (out && !/^https?:\/\//i.test(out)) out = "http://" + out;
  out = out.replace(/^http:\/\/localhost(?=[:\/]|$)/i, "http://127.0.0.1");
  out = out.replace(/^https:\/\/localhost(?=[:\/]|$)/i, "https://127.0.0.1");
  return out;
}

function fmtMs(ms) {
  if (ms == null) return "—";
  const total = Math.max(0, Number(ms) || 0);
  const sec = Math.floor(total / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const tenths = Math.floor((total % 1000) / 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${tenths}`;
}

// ✅ اسم محفوظ صالح؟
function getSavedPlayerName() {
  const raw = (localStorage.getItem(LS_PLAYER) || "").trim();
  if (!raw) return "";
  if (raw.toLowerCase() === "guest") return "";
  return raw;
}

export default function LevelsPage() {
  const nav = useNavigate();

const [backendUrl, setBackendUrl] = useState(
  localStorage.getItem(LS_BACKEND) ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:4000"
);

  // (topBar مخفي أصلاً)
  const [playerName, setPlayerName] = useState(
    localStorage.getItem(LS_PLAYER) || "Guest"
  );

  const [levels, setLevels] = useState([]);
  const [err, setErr] = useState("");

  // ✅ Hall of Fame modal state
  const [boardOpen, setBoardOpen] = useState(false);
  const [boardLevel, setBoardLevel] = useState("L1");
  const [boardRows, setBoardRows] = useState([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardErr, setBoardErr] = useState("");

  // ✅ Name modal state
  const [nameOpen, setNameOpen] = useState(false);
  const [pendingLevelId, setPendingLevelId] = useState(null);
  const [nameValue, setNameValue] = useState("");
  const [nameErr, setNameErr] = useState("");

  async function loadLevels(urlRaw) {
    const url = normUrl(urlRaw);
    setErr("");
    try {
      const res = await fetch(`${url}/api/levels`);
      if (!res.ok) throw new Error("levels_fetch_failed");
      const data = await res.json();
      setLevels(Array.isArray(data) ? data : []);
    } catch (e) {
      setLevels([]);
      setErr("غلط بـ Backend URL أو السيرفر مش شغّال.");
    }
  }

  function saveAndRefresh() {
    const clean = normUrl(backendUrl);
    localStorage.setItem(LS_BACKEND, clean);

    const fixed = (playerName || "").trim();
    localStorage.setItem(LS_PLAYER, fixed || "Guest");

    loadLevels(clean);
  }

  useEffect(() => {
    loadLevels(backendUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = useMemo(() => {
    const m = new Map();
    for (const l of levels) m.set(l.id, l);
    return m;
  }, [levels]);

  // ✅ الدخول على الليفيل: إذا ما في اسم محفوظ -> افتح مودال الاسم
  function requestPlay(levelId) {
    const saved = getSavedPlayerName();
    if (saved) {
      nav(`/play/${levelId}`);
      return;
    }

    setPendingLevelId(levelId);
    setNameErr("");
    setNameValue("");
    setNameOpen(true);
  }

  function cancelName() {
    setNameOpen(false);
    setPendingLevelId(null);
    setNameErr("");
  }

  function submitName() {
    const v = (nameValue || "").trim();

    if (!v) {
      setNameErr("لازم تكتب اسمك.");
      return;
    }
    if (v.toLowerCase() === "guest") {
      setNameErr("اختار اسم غير Guest.");
      return;
    }

    localStorage.setItem(LS_PLAYER, v);
    setPlayerName(v);

    const lvl = pendingLevelId || "L1";
    setNameOpen(false);
    setPendingLevelId(null);
    setNameErr("");

    nav(`/play/${lvl}`);
  }

  // Enter / Escape داخل مودال الاسم
  useEffect(() => {
    if (!nameOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") cancelName();
      if (e.key === "Enter") submitName();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameOpen, nameValue, pendingLevelId]);

  async function loadLeaderboard(levelId) {
    const url = normUrl(backendUrl);
    setBoardErr("");
    setBoardLoading(true);
    try {
      const res = await fetch(
        `${url}/api/leaderboard?levelId=${encodeURIComponent(levelId)}`
      );
      if (!res.ok) throw new Error("leaderboard_fetch_failed");
      const rows = await res.json();
      setBoardRows(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setBoardRows([]);
      setBoardErr("مش قادر أجيب الـLeaderboard. تأكد السيرفر شغّال والـURL صح.");
    } finally {
      setBoardLoading(false);
    }
  }

  useEffect(() => {
    if (!boardOpen) return;
    loadLeaderboard(boardLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardOpen]);

  useEffect(() => {
    if (!boardOpen) return;
    loadLeaderboard(boardLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardLevel]);

  useEffect(() => {
    if (!boardOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setBoardOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [boardOpen]);

  return (
    <div className="page">
      <div className="topBar">
        <div className="field">
          <div className="label">Backend Base URL</div>
          <input
            className="input"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
          />
        </div>

        <div className="field">
          <div className="label">Player Name</div>
          <input
            className="input"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
        </div>

        <button className="btn" onClick={saveAndRefresh}>
          Save & Refresh
        </button>
      </div>

      {err ? <div className="error">{err}</div> : null}

      {/* ✅ الصورة تبعت الليفيلات + أزرار فوقها */}
      <div className="heroWrap">
<img
  className="heroImg"
src="/assets/levels-map/levels.png"
  alt="Levels"
/>
        <button
          className="levelBtn btnL1"
          title={byId.get("L1")?.name || "Level 1"}
          onClick={() => requestPlay("L1")}
        />
        <button
          className="levelBtn btnL2"
          title={byId.get("L2")?.name || "Level 2"}
          onClick={() => requestPlay("L2")}
        />
        <button
          className="levelBtn btnL3"
          title={byId.get("L3")?.name || "Level 3"}
          onClick={() => requestPlay("L3")}
        />

       <button
  className="hofHotspot"
  onClick={() => setBoardOpen(true)}
  aria-label="Open Hall of Fame"
  title="Hall of Fame"
/>
      </div>

     {/* ✅ Name Modal (Image UI) */}
{nameOpen && (
  <div className="modalOverlay" onClick={cancelName}>
    <div className="nameModalArt" onClick={(e) => e.stopPropagation()}>
      {/* صورة التصميم */}
      <img
        className="nameArtImg"
        src="/assets/ui/your-name.png"
        alt="Enter your name"
        draggable={false}
      />

      {/* ✅ Input حقيقي فوق خانة الاسم بالصورة */}
      <input
        className="nameArtInput"
        value={nameValue}
        onChange={(e) => {
          setNameValue(e.target.value);
          setNameErr("");
        }}
        placeholder=""
        autoFocus
      />

      {/* ✅ زر Enter مخفي فوق زر Enter بالصورة */}
      <button
        className="nameArtEnter"
        onClick={submitName}
        aria-label="Enter"
        title="Enter"
      />

      {/* ✅ زر Cancel مخفي فوق زر Cancel بالصورة */}
      <button
        className="nameArtCancel"
        onClick={cancelName}
        aria-label="Cancel"
        title="Cancel"
      />

      {/* (اختياري) إظهار خطأ تحت المودال */}
      {nameErr ? <div className="nameArtErr">{nameErr}</div> : null}
    </div>
  </div>
)}

{/* ✅ Hall of Fame Modal (Image UI) */}
{boardOpen && (
  <div className="modalOverlay" onClick={() => setBoardOpen(false)}>
    <div className="hofArtModal" onClick={(e) => e.stopPropagation()}>
      {/* الخلفية صورة */}
      <img
        className="hofArtImg"
        src="/assets/ui/hall-cover.png"
        alt="Hall of Fame"
        draggable={false}
      />

      {/* زر X (شفاف فوق الـ X بالصورة) */}
      <button
        className="hofArtClose"
        onClick={() => setBoardOpen(false)}
        aria-label="Close"
        title="Close"
        type="button"
      />

      {/* ✅ Tabs L1/L2/L3 (زجاج فوق الصورة) */}
      <button
        className={`hofTab hofTabL1 ${boardLevel === "L1" ? "hofTabActive" : ""}`}
        onClick={() => setBoardLevel("L1")}
        aria-label="Level L1"
        title="L1"
        type="button"
      >
        L1
      </button>

      <button
        className={`hofTab hofTabL2 ${boardLevel === "L2" ? "hofTabActive" : ""}`}
        onClick={() => setBoardLevel("L2")}
        aria-label="Level L2"
        title="L2"
        type="button"
      >
        L2
      </button>

      <button
        className={`hofTab hofTabL3 ${boardLevel === "L3" ? "hofTabActive" : ""}`}
        onClick={() => setBoardLevel("L3")}
        aria-label="Level L3"
        title="L3"
        type="button"
      >
        L3
      </button>

      {/* ✅ الجدول الحقيقي فوق الصورة (بدون ما نغيّر الشكل) */}
      <div className="hofTableWrap">
        <table className="hofTable">
          <tbody>
            {/* لو بدك تضل 7 سطور ثابتة عشان يركبوا عالصورة */}
            {Array.from({ length: 7 }).map((_, i) => {
              const r = boardRows?.[i];
              return (
                <tr key={r?.id ?? `${r?.player_name ?? "row"}-${i}`}>
                  <td>{i + 1}</td>
                  <td>{r ? r.player_name : ""}</td>
                  <td>{r ? fmtMs(r.time_ms) : ""}</td>
                  <td>{r ? (r.ticks ?? "—") : ""}</td>
                  <td>{r ? (r.score ?? "—") : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Error (لو في) */}
      {boardErr ? <div className="hofArtErr">{boardErr}</div> : null}
    </div>
  </div>
)}
    </div>
  );
}
