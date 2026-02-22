import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { predictMove } from "../../game/predict/predictMove";
import { apiGetLevels, apiGetLevel, apiSaveRun, normBaseUrl } from "../../app/apiClient/client";

import GameCanvas from "../../components/Grid/GameCanvas";
import HUD from "../../components/HUD/HUD";
import Controls from "../../components/Controls/Controls";
import "./PlayPage.css";

// سرعة حركة الحراس (كل ما قلّي الرقم = أسرع)
const GUARD_TICK_MS = 180;

function fmtTime(ms) {
  const total = Math.max(0, ms);
  const sec = Math.floor(total / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const tenths = Math.floor((total % 1000) / 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${tenths}`;
}

function getQueryLevelId() {
  const u = new URL(window.location.href);
  return u.searchParams.get("levelId");
}

function nextFromId(id) {
  const m = String(id || "").match(/^L(\d+)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const next = `L${n + 1}`;
  if (next === "L4") return null;
  return next;
}

export default function PlayPage() {
  const nav = useNavigate();
  const params = useParams();

  const baseUrl = useMemo(() => {
    const saved = localStorage.getItem("heist_backend_url");
    const env = import.meta.env.VITE_API_BASE_URL;
    const fallback = import.meta.env.DEV ? "http://127.0.0.1:4000" : window.location.origin;
    return normBaseUrl(saved || env || fallback);
  }, []);

  const playerName = useMemo(
    () => (localStorage.getItem("heist_player_name") || "Guest").trim(),
    []
  );

  const [levelsList, setLevelsList] = useState([]);
  const [levelMeta, setLevelMeta] = useState(null);
  const [level, setLevel] = useState(null);

  // frame اللي GameCanvas برسمه
  const [frame, setFrame] = useState(null);

  // نتيحة HUD (محلي)
  const [result, setResult] = useState({ ticks: 0, score: 0, alerts: 0 });

  // refs
  const levelRef = useRef(null);
  const frameRef = useRef(null);
  const startPerfRef = useRef(0);
  const hudTimerRef = useRef(null);
  const guardTimerRef = useRef(null);

  const [timeText, setTimeText] = useState("00:00.0");

  const [overlay, setOverlay] = useState({ open: false, kind: "info", timeMs: null });
  const [currentLevelId, setCurrentLevelId] = useState(null);

  const nextLevelId = useMemo(
    () => nextFromId(currentLevelId || levelMeta?.id),
    [currentLevelId, levelMeta?.id]
  );

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  function stopHudTimer() {
    if (hudTimerRef.current) clearInterval(hudTimerRef.current);
    hudTimerRef.current = null;
  }

  function startHudTimer() {
    stopHudTimer();
    startPerfRef.current = performance.now();
    setTimeText("00:00.0");

    hudTimerRef.current = setInterval(() => {
      setTimeText(fmtTime(performance.now() - startPerfRef.current));
    }, 100);
  }

  function stopGuardTimer() {
    if (guardTimerRef.current) clearInterval(guardTimerRef.current);
    guardTimerRef.current = null;
  }

  function makeInitialFrame(lvl) {
    const start = lvl?.start ?? { x: 0, y: (lvl?.size?.h ?? 15) - 1 };

    // نخزّن مسارات الحراس داخليًا داخل عنصر guard نفسه
    const guards = (lvl?.guards || []).map((g) => ({
      x: Number(g.x),
      y: Number(g.y),
      visionRange: Number(g.visionRange ?? 4),
      __path: Array.isArray(g.path) ? g.path.map((p) => ({ x: Number(p.x), y: Number(p.y) })) : [],
      __i: 0,
    }));

    return {
      player: { x: Number(start.x), y: Number(start.y), hasKey: false },
      guards,
      cameras: lvl?.cameras || [],
    };
  }

  function isLoseNow(f) {
    const px = f?.player?.x;
    const py = f?.player?.y;
    if (!Number.isFinite(px) || !Number.isFinite(py)) return false;
    const guards = Array.isArray(f?.guards) ? f.guards : [];
    return guards.some((g) => Number(g.x) === px && Number(g.y) === py);
  }

  function isWinNow(f, lvl) {
    if (!lvl?.home) return false;
    const px = f?.player?.x;
    const py = f?.player?.y;
    if (px !== lvl.home.x || py !== lvl.home.y) return false;
    const keyRequired = !!(lvl?.rules?.keyRequired ?? true);
    return !keyRequired || !!f?.player?.hasKey;
  }

  function updateScore(ticks, ms) {
    // سكور بسيط: أقل وقت وأقل خطوات أحسن
    const timeScore = Math.max(0, 300000 - ms); // 5 دقائق سقف
    const stepScore = Math.max(0, 5000 - ticks * 20);
    return Math.floor(timeScore / 100 + stepScore / 10);
  }

  function startGuardsLoop() {
    stopGuardTimer();

    guardTimerRef.current = setInterval(() => {
      const lvl = levelRef.current;
      const cur = frameRef.current;
      if (!lvl || !cur || overlay.open) return;

      const guards = Array.isArray(cur.guards) ? cur.guards : [];
      let changed = false;

      const nextGuards = guards.map((g) => {
        const path = Array.isArray(g.__path) ? g.__path : [];
        if (path.length < 2) return g;

        const nextI = (Number(g.__i || 0) + 1) % path.length;
        const pos = path[nextI];

        changed = true;
        return { ...g, x: pos.x, y: pos.y, __i: nextI };
      });

      if (!changed) return;

      const nextFrame = { ...cur, guards: nextGuards };
      setFrame(nextFrame);
      frameRef.current = nextFrame;

      // lose check بسبب الحارس
      if (isLoseNow(nextFrame)) {
        setOverlay({ open: true, kind: "lose", timeMs: null });
        stopGuardTimer();
        stopHudTimer();
      }
    }, GUARD_TICK_MS);
  }

  async function loadLevel(levelId) {
    stopGuardTimer();
    stopHudTimer();
    setOverlay({ open: false, kind: "info", timeMs: null });

    setCurrentLevelId(levelId);

    const meta = await apiGetLevel(baseUrl, levelId);
    meta.id = meta.id ?? levelId;

    const data = meta.data || meta.level;
    setLevelMeta(meta);
    setLevel(data);

    const initFrame = makeInitialFrame(data);
    setFrame(initFrame);
    frameRef.current = initFrame;

    setResult({ ticks: 0, score: 0, alerts: 0 });
    startHudTimer();
    startGuardsLoop();
  }

  async function restartLevel() {
    const id = currentLevelId || levelMeta?.id || "L1";
    await loadLevel(id);
  }

  function finishWin() {
    const ms = performance.now() - startPerfRef.current;
    const timeMs = Math.max(1, Math.round(ms));
    setOverlay({ open: true, kind: "win", timeMs });

    stopGuardTimer();
    stopHudTimer();

    // حفظ سكور (اختياري)
    void (async () => {
      try {
        await apiSaveRun(baseUrl, {
          levelId: currentLevelId || levelMeta?.id,
          playerName,
          sessionId: "client-only",
          timeMs,
          ticks: result.ticks,
          alerts: 0,
        });
      } catch (e) {
        console.warn("save run failed:", e);
      }
    })();
  }

  function enqueueMove(mv) {
    if (overlay.open) return;

    const lvl = levelRef.current;
    const cur = frameRef.current;
    if (!lvl || !cur) return;

    // ✅ بدك تزيد steps حتى لو ضرب جدار؟ هيك:
    const nextTicks = Number(result.ticks || 0) + 1;

    // prediction محلي
    const r = predictMove(cur, lvl, mv);

    // إذا blocked: ما تحركي اللاعب، بس زيدي ticks
    const nextFrame = r.ok ? r.nextFrame : cur;

    // تحديث محلي فوري
    setFrame(nextFrame);
    frameRef.current = nextFrame;

    const ms = performance.now() - startPerfRef.current;
    const score = updateScore(nextTicks, ms);
    setResult((prev) => ({ ...prev, ticks: nextTicks, score }));

    // key pickup موجود جوّا predictMove (hasKey)
    // lose / win checks
    if (isLoseNow(nextFrame)) {
      setOverlay({ open: true, kind: "lose", timeMs: null });
      stopGuardTimer();
      stopHudTimer();
      return;
    }

    if (isWinNow(nextFrame, lvl)) {
      finishWin();
    }
  }

  // init
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const lvls = await apiGetLevels(baseUrl);
        if (!alive) return;
        setLevelsList(lvls);

        const levelId = params.levelId || getQueryLevelId() || "L1";
        await loadLevel(levelId);
      } catch (e) {
        console.warn("init failed:", e);
      }
    })();

    return () => {
      alive = false;
      stopGuardTimer();
      stopHudTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.levelId]);

  // keyboard
  useEffect(() => {
    const onKeyDown = (e) => {
      if (overlay.open) return;

      const keysToBlock = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "];
      if (keysToBlock.includes(e.key)) e.preventDefault();

      let mv = null;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") mv = "U";
      else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") mv = "D";
      else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") mv = "L";
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") mv = "R";
      else if (e.key === " ") mv = "S";

      if (mv) enqueueMove(mv);
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [overlay.open, result.ticks]);

  const title = levelMeta ? `${levelMeta.id} — ${levelMeta.name}` : "Loading...";

  return (
    <div className="playPage">
      <div className="topBar">
        <div className="topLeft">
          <button className="btn" onClick={() => nav("/levels")}>Back</button>
          <button className="btn" onClick={restartLevel} disabled={!levelMeta}>Restart</button>
        </div>

        <div className="timeCenter">⏱ {timeText}</div>

        <div className="topRight">
          <HUD
            title={title}
            timeText={timeText}
            ticks={result?.ticks}
            score={result?.score}
            hasKey={frame?.player?.hasKey}
          />
        </div>
      </div>

      <div className="boardWrap">
        <GameCanvas level={level} frame={frame} />
      </div>

      <Controls onMove={enqueueMove} />

      {overlay.open && (
        <div className="modalOverlay">
          <div className="resultArtModal">
            <img
              className="resultArtImg"
              src={overlay.kind === "win" ? "/assets/ui/win-overlay.png" : "/assets/ui/lose-overlay.png"}
              alt={overlay.kind === "win" ? "Win" : "Lose"}
              draggable={false}
            />

            {overlay.kind === "win" && typeof overlay.timeMs === "number" && (
              <div className="winTimeText">⏱ {fmtTime(overlay.timeMs)}</div>
            )}

            {overlay.kind === "win" && (
              <>
                <button
                  className="resHotspot winBack"
                  onClick={() => { setOverlay({ open: false, kind: "info", timeMs: null }); nav("/levels"); }}
                  aria-label="Back"
                  title="Back"
                  type="button"
                />
                {nextLevelId && (
                  <button
                    className="resHotspot winNext"
                    onClick={() => { setOverlay({ open: false, kind: "info", timeMs: null }); nav(`/play/${nextLevelId}`); }}
                    aria-label="Next"
                    title="Next"
                    type="button"
                  />
                )}
              </>
            )}

            {overlay.kind === "lose" && (
              <>
                <button
                  className="resHotspot loseTry"
                  onClick={() => { setOverlay({ open: false, kind: "info", timeMs: null }); void restartLevel(); }}
                  aria-label="Try again"
                  title="Try again"
                  type="button"
                />
                <button
                  className="resHotspot loseBack"
                  onClick={() => { setOverlay({ open: false, kind: "info", timeMs: null }); nav("/levels"); }}
                  aria-label="Back"
                  title="Back"
                  type="button"
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}