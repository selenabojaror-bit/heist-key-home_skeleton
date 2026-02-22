function safeNum(x, fallback) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeLevel(levelRaw) {
  const w = safeNum(levelRaw?.size?.w ?? levelRaw?.w, 15);
  const h = safeNum(levelRaw?.size?.h ?? levelRaw?.h, 15);

  return {
    ...levelRaw,
    size: { w, h },
    start: levelRaw?.start ?? { x: 0, y: h - 1 },
    key: levelRaw?.key ?? { x: 1, y: 1 },
    home: levelRaw?.home ?? { x: w - 1, y: h - 1 },
    walls: Array.isArray(levelRaw?.walls) ? levelRaw.walls : [],
    guards: Array.isArray(levelRaw?.guards) ? levelRaw.guards : [],
    cameras: [], // ✅ ما في كاميرات
  };
}

function resizeCanvasToDisplaySize(canvas, ctx) {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const cssW = Math.max(1, Math.floor(canvas.clientWidth));
  const cssH = Math.max(1, Math.floor(canvas.clientHeight));
  const wantW = Math.floor(cssW * dpr);
  const wantH = Math.floor(cssH * dpr);

  if (canvas.width !== wantW || canvas.height !== wantH) {
    canvas.width = wantW;
    canvas.height = wantH;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function loadImg(src) {
  const img = new Image();
  img.src = src;
  return img;
}

function ready(img) {
  return img && img.complete && img.naturalWidth > 0;
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

function drawKeyIcon(ctx, x, y, w, h) {
  const s = Math.min(w, h);
  const cx = x + w * 0.38;
  const cy = y + h * 0.40;
  const r = Math.max(6, s * 0.18);
  const strokeW = Math.max(2, s * 0.06);

  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.70)";
  ctx.lineWidth = strokeW;
  ctx.stroke();

  const stemX = cx + r * 0.65;
  const stemY = cy - r * 0.20;
  const stemW = r * 1.35;
  const stemH = r * 0.40;

  ctx.fillStyle = "#ffd166";
  ctx.fillRect(stemX, stemY, stemW, stemH);
  ctx.strokeRect(stemX, stemY, stemW, stemH);
}

export function makeRenderer(canvas) {
  if (!canvas) throw new Error("Canvas not found");
  const ctx = canvas.getContext("2d");

  // ✅ أهم تعديل: خلي المسار مطلق (/assets/...)
  const AS = "/assets/";

  // صور world
  const floorImg = loadImg(AS + "sprites/world/grass.png");
  const wallImg = loadImg(AS + "sprites/world/wall.png");
  const houseImg = loadImg(AS + "sprites/world/house.png");
  const keyImg = loadImg(AS + "sprites/items/key.png");

  // Mark (اللاعب)
  const MARK_BASE = AS + "sprites/mark/";
  const mark = {
    idle: {
      down: loadImg(MARK_BASE + "mark1.png"),
      right: loadImg(MARK_BASE + "mark3.png"),
      up: loadImg(MARK_BASE + "mark4.png"),
      left: loadImg(MARK_BASE + "mark5.png"),
    },
    walk: {
      down: [7, 8, 9, 10].map((n) => loadImg(MARK_BASE + `mark${n}.png`)),
      right: [11, 12, 13, 14, 15].map((n) => loadImg(MARK_BASE + `mark${n}.png`)),
      up: [16, 17, 18, 19].map((n) => loadImg(MARK_BASE + `mark${n}.png`)),
      left: [20, 21, 22, 23, 24].map((n) => loadImg(MARK_BASE + `mark${n}.png`)),
    },
  };

  // Guards
  // ✅ لاحظي: عندك المجلدات Back / Front / left / right (حسب الصورة)
  const G_BASE = AS + "sprites/guard/";
  const pickFrames = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27];

  function loadGuardDir(dirFolderName) {
    return pickFrames.map((i) =>
      loadImg(`${G_BASE}${dirFolderName}/0_Citizen_Walk_${pad3(i)}.png`)
    );
  }

  const guardSprites = {
    down: loadGuardDir("Front"),
    up: loadGuardDir("Back"),
    left: loadGuardDir("left"),
    right: loadGuardDir("right"),
  };

  let lastPX = null;
  let lastPY = null;
  let lastPlayerDir = "down";
  let lastPlayerMoveAt = 0;

  const guardState = new Map();

  function pickDir(dx, dy, prevDir) {
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
    if (dy !== 0) return dy > 0 ? "down" : "up";
    return prevDir || "down";
  }

  function drawKeyFromImageOrFallback(x, y, w, h) {
    if (ready(keyImg)) ctx.drawImage(keyImg, x, y, w, h);
    else drawKeyIcon(ctx, x, y, w, h);
  }

  function drawSprite(img, tileX, tileY, cellW, cellH, fallbackColor) {
    if (!ready(img)) {
      const cx = tileX + cellW / 2;
      const cy = tileY + cellH / 2;
      const r = Math.min(cellW, cellH) * 0.28;
      ctx.fillStyle = fallbackColor;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const scale = Math.min((cellH * 0.92) / img.height, (cellW * 0.92) / img.width);
    const dw = img.width * scale;
    const dh = img.height * scale;

    const dx = tileX + (cellW - dw) / 2;
    const dy = tileY + (cellH - dh);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function drawMark(tileX, tileY, cellW, cellH, p) {
    const now = performance.now();

    if (lastPX !== null && lastPY !== null) {
      const dx = p.x - lastPX;
      const dy = p.y - lastPY;
      if (dx !== 0 || dy !== 0) {
        lastPlayerDir = pickDir(dx, dy, lastPlayerDir);
        lastPlayerMoveAt = now;
      }
    }
    lastPX = p.x;
    lastPY = p.y;

    const isWalking = now - lastPlayerMoveAt < 220;
    let img = null;

    if (isWalking) {
      const arr = mark.walk[lastPlayerDir] || [];
      const idx = arr.length ? Math.floor(now / 110) % arr.length : 0;
      img = arr[idx];
    } else {
      img = mark.idle[lastPlayerDir] || mark.idle.down;
    }

    drawSprite(img, tileX, tileY, cellW, cellH, "#46a3ff");
  }

  function getGuardXY(g) {
    if (Number.isFinite(g?.x) && Number.isFinite(g?.y)) return { x: g.x, y: g.y };
    if (Number.isFinite(g?.pos?.x) && Number.isFinite(g?.pos?.y)) return { x: g.pos.x, y: g.pos.y };
    return { x: NaN, y: NaN };
  }

  function drawGuard(i, g, cellW, cellH) {
    const now = performance.now();
    const { x, y } = getGuardXY(g);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const st = guardState.get(i) || { x, y, dir: "down", moveAt: 0 };
    const dx = x - st.x;
    const dy = y - st.y;

    if (dx !== 0 || dy !== 0) {
      st.dir = pickDir(dx, dy, st.dir);
      st.moveAt = now;
      st.x = x;
      st.y = y;
    }

    const arr = guardSprites[st.dir] || guardSprites.down;
    const idx = arr.length ? Math.floor(now / 140) % arr.length : 0;

    drawSprite(arr[idx], x * cellW, y * cellH, cellW, cellH, "#ff0000");
    guardState.set(i, st);
  }

  function draw(levelRaw, frame) {
    resizeCanvasToDisplaySize(canvas, ctx);

    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);

    if (!levelRaw) return;
    const level = normalizeLevel(levelRaw);

    const cellW = W / level.size.w;
    const cellH = H / level.size.h;

    // Floor
    for (let y = 0; y < level.size.h; y++) {
      for (let x = 0; x < level.size.w; x++) {
        const px = x * cellW;
        const py = y * cellH;
        if (ready(floorImg)) ctx.drawImage(floorImg, px, py, cellW, cellH);
        else {
          ctx.fillStyle = (x + y) % 2 === 0 ? "#2f7d45" : "#2b6f3e";
          ctx.fillRect(px, py, cellW, cellH);
        }
      }
    }

    // Walls
    for (const w of level.walls) {
      const x = safeNum(w?.x, -1);
      const y = safeNum(w?.y, -1);
      if (x < 0 || y < 0 || x >= level.size.w || y >= level.size.h) continue;

      const px = x * cellW;
      const py = y * cellH;

      if (ready(wallImg)) ctx.drawImage(wallImg, px, py, cellW, cellH);
      else {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(px, py, cellW, cellH);
      }
    }

    const p = frame?.player;
    const hasKey = !!p?.hasKey;

    // Key
    if (level.key && !hasKey) {
      const px = level.key.x * cellW;
      const py = level.key.y * cellH;
      drawKeyFromImageOrFallback(px + cellW * 0.10, py + cellH * 0.10, cellW * 0.80, cellH * 0.80);
    }

    // Home
    if (level.home) {
      const px = level.home.x * cellW;
      const py = level.home.y * cellH;
      if (ready(houseImg)) {
        const scale = Math.min((cellH * 0.95) / houseImg.height, (cellW * 0.95) / houseImg.width);
        const dw = houseImg.width * scale;
        const dh = houseImg.height * scale;
        ctx.drawImage(houseImg, px + (cellW - dw) / 2, py + (cellH - dh), dw, dh);
      } else {
        ctx.fillStyle = "#2ecc71";
        ctx.fillRect(px + 2, py + 2, cellW - 4, cellH - 4);
      }
    }

    // Guards
    const guards = Array.isArray(frame?.guards) ? frame.guards : [];
    for (let i = 0; i < guards.length; i++) drawGuard(i, guards[i], cellW, cellH);

    // Player
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      drawMark(p.x * cellW, p.y * cellH, cellW, cellH, p);

      // Key badge if carried
      if (hasKey) {
        const s = 0.45;
        drawKeyFromImageOrFallback(
          p.x * cellW + cellW * (1 - s),
          p.y * cellH + cellH * (1 - s),
          cellW * s,
          cellH * s
        );
      }
    }
  }

  return { draw };
}

export default makeRenderer;
