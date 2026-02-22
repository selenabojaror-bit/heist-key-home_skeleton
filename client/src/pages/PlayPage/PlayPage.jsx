import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { predictMove } from "../../game/predict/predictMove";

import {
  apiGetLevels,
  apiGetLevel,
  apiSaveRun,
  apiSessionStart,
  apiSessionStep,
  normBaseUrl,
} from "../../app/apiClient/client";

import GameCanvas from "../../components/Grid/GameCanvas";
import HUD from "../../components/HUD/HUD";
import Controls from "../../components/Controls/Controls";
import "./PlayPage.css";

// ✅ polling للحارس/التحديثات (بدون ضغط على الشبكة)
const POLL_MS = 200;

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
  // يدعم L1/L2/L3
  const m = String(id || "").match(/^L(\d+)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const next = `L${n + 1}`;
  // ✅ آخر ليفيل عندك L3 → ما في Next
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
    const s = saved || env || fallback;
    return normBaseUrl(s);
  }, []);

  const playerName = useMemo(
    () => (localStorage.getItem("heist_player_name") || "Guest").trim(),
    []
  );

  const [levelsList, setLevelsList] = useState([]);
  const [levelMeta, setLevelMeta] = useState(null);
  const [level, setLevel] = useState(null);

  const [frame, setFrame] = useState(null);
  const [result, setResult] = useState(null);

  // ✅ refs for instant prediction + reconciliation
  const frameRef = useRef(null);
  const levelRef = useRef(null);

  // ✅ moves pressed locally but not yet confirmed by server
  const pendingRef = useRef([]);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);
  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  const [overlay, setOverlay] = useState({
    open: false,
    kind: "info", // "win" | "lose" | "info"
    timeMs: null,
  });

  const [currentLevelId, setCurrentLevelId] = useState(null);

  // session + network control
  const sessionIdRef = useRef(null);
  const activeLevelIdRef = useRef(null);
  const abortRef = useRef(null);
  const busyRef = useRef(false);
  const endingRef = useRef(false);

  // polling + queue
  const pollTimerRef = useRef(null);
  const moveQueueRef = useRef([]);

  // HUD timer (display only)
  const startPerfRef = useRef(0);
  const hudTimerRef = useRef(null);
  const [timeText, setTimeText] = useState("00:00.0");

  const nextLevelId = useMemo(
    () => nextFromId(currentLevelId || levelMeta?.id),
    [currentLevelId, levelMeta?.id]
  );

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

  function cancelInFlight() {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = null;
  }

  function stopPoll() {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
  }

  function startPoll() {
    stopPoll();
    pollTimerRef.current = setInterval(() => {
      if (endingRef.current) return;
      if (moveQueueRef.current.length) return;
      if (busyRef.current) return;
      void stepServer(null); // تحديثات الحارس/النتيجة
    }, POLL_MS);
  }

  async function startSessionForLevel(levelId) {
    activeLevelIdRef.current = levelId;
    setCurrentLevelId(levelId);

    endingRef.current = false;
    busyRef.current = false;
    moveQueueRef.current = [];
    pendingRef.current = [];

    cancelInFlight();
    const start = await apiSessionStart(baseUrl, levelId);

    sessionIdRef.current = start.sessionId;

    setFrame(start.frame);
    frameRef.current = start.frame;

    setResult(start.result);

    startHudTimer();
  }

  async function loadLevel(levelId) {
    activeLevelIdRef.current = levelId;
    setCurrentLevelId(levelId);

    stopPoll();
    stopHudTimer();
    cancelInFlight();

    moveQueueRef.current = [];
    pendingRef.current = [];

    const meta = await apiGetLevel(baseUrl, levelId);
    meta.id = meta.id ?? levelId;

    const data = meta.data || meta.level;

    setLevelMeta(meta);
    setLevel(data);
    levelRef.current = data;

    await startSessionForLevel(levelId);
    startPoll();
  }

  async function restartLevel() {
    const id = activeLevelIdRef.current || currentLevelId || levelMeta?.id || "L1";
    await loadLevel(id);
  }

  async function stepServer(move) {
    if (!sessionIdRef.current) return;
    if (busyRef.current) return;
    if (endingRef.current) return;

    busyRef.current = true;

    cancelInFlight();
    abortRef.current = new AbortController();

    try {
      const out = await apiSessionStep(
        baseUrl,
        sessionIdRef.current,
        move ?? undefined,
        { signal: abortRef.current.signal }
      );

      // ✅ 1) السيرفر مصدر الحقيقة
      let base = out.frame;

      // ✅ 2) إذا هذا الرد نتيجة move، شيل أول pending (لو مطابق)
      if (move && pendingRef.current.length && pendingRef.current[0] === move) {
        pendingRef.current.shift();
      }

      // ✅ 3) Reconciliation: طبّق باقي pending فوق فريم السيرفر
      const lv = levelRef.current;
      if (lv && pendingRef.current.length) {
        let f = base;
        const still = [];

        for (const mv2 of pendingRef.current) {
          const r = predictMove(f, lv, mv2);
          if (!r.ok) break; // إذا صار اختلاف، وقف
          f = r.nextFrame;
          still.push(mv2);
        }

        base = f;
        pendingRef.current = still;
      }

      setFrame(base);
      frameRef.current = base;

      setResult(out.result);

      if (out?.result?.lose) {
        await handleLose();
        return;
      }

      if (out?.result?.win) {
        await handleWin(out);
        return;
      }
    } catch (e) {
      if (e?.name !== "AbortError") console.warn("step failed:", e);
    } finally {
      busyRef.current = false;

      if (moveQueueRef.current.length && !endingRef.current) {
        const next = moveQueueRef.current.shift();
        if (next) void stepServer(next);
      }
    }
  }

  async function handleWin(out) {
    if (endingRef.current) return;
    endingRef.current = true;

    stopPoll();
    stopHudTimer();

    const serverTimeMs = out?.result?.timeMs;

    setOverlay({
      open: true,
      kind: "win",
      timeMs: typeof serverTimeMs === "number" ? Math.round(serverTimeMs) : null,
    });

    try {
      await apiSaveRun(baseUrl, {
        levelId: activeLevelIdRef.current,
        playerName,
        sessionId: sessionIdRef.current,
        timeMs: Math.max(1, Number(out?.result?.timeMs ?? 0)),
        ticks: out?.result?.ticks,
        alerts: out?.result?.alerts,
      });
    } catch (e) {
      console.warn("save run failed:", e);
    }
  }

  async function handleLose() {
    if (endingRef.current) return;
    endingRef.current = true;

    stopPoll();
    stopHudTimer();

    setOverlay({
      open: true,
      kind: "lose",
      timeMs: null,
    });
  }

  function enqueueMove(mv) {
    if (endingRef.current) return;
    if (moveQueueRef.current.length > 8) return;

    const curFrame = frameRef.current;
    const curLevel = levelRef.current;
    if (!curFrame || !curLevel) return;

    // ✅ Prediction: لو ممنوع (جدار/حدود) ما تتحركي أصلاً
    const { nextFrame, ok } = predictMove(curFrame, curLevel, mv);
    if (!ok) return;

    // ✅ حركة فورية على الشاشة
    setFrame(nextFrame);
    frameRef.current = nextFrame;

    // ✅ pending للحفاظ على السلاسة (reconciliation)
    pendingRef.current.push(mv);

    // ✅ ابعت للسيرفر
    if (!busyRef.current) {
      void stepServer(mv);
      return;
    }
    moveQueueRef.current.push(mv);
  }

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
      stopPoll();
      stopHudTimer();
      cancelInFlight();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.levelId]);

  // keyboard
  useEffect(() => {
    const onKeyDown = (e) => {
      if (endingRef.current) return;

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
  }, []);

  const title = levelMeta ? `${levelMeta.id} — ${levelMeta.name}` : "Loading...";

  return (
    <div className="playPage">
      <div className="topBar">
        <div className="topLeft">
          <button className="btn" onClick={() => nav("/levels")}>
            Back
          </button>
          <button className="btn" onClick={restartLevel} disabled={!levelMeta}>
            Restart
          </button>
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
                  onClick={() => {
                    setOverlay({ open: false, kind: "info", timeMs: null });
                    nav("/levels");
                  }}
                  aria-label="Back"
                  title="Back"
                  type="button"
                />

                {nextLevelId && (
                  <button
                    className="resHotspot winNext"
                    onClick={() => {
                      setOverlay({ open: false, kind: "info", timeMs: null });
                      nav(`/play/${nextLevelId}`);
                    }}
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
                  onClick={() => {
                    setOverlay({ open: false, kind: "info", timeMs: null });
                    void restartLevel();
                  }}
                  aria-label="Try again"
                  title="Try again"
                  type="button"
                />

                <button
                  className="resHotspot loseBack"
                  onClick={() => {
                    setOverlay({ open: false, kind: "info", timeMs: null });
                    nav("/levels");
                  }}
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