import { useEffect, useRef } from "react";
import makeRenderer from "../../canvas/renderer";

function resizeCanvasToContainer(canvas) {
  const parent = canvas.parentElement;
  if (!parent) return false;

  const rect = parent.getBoundingClientRect();
  const cssW = Math.max(1, Math.floor(rect.width));
  const cssH = Math.max(1, Math.floor(rect.height));

  const dpr = window.devicePixelRatio || 1;
  const pxW = Math.floor(cssW * dpr);
  const pxH = Math.floor(cssH * dpr);

  // خليه ياخذ حجم CSS تبع الحاوية
  canvas.style.width = "100%";
  canvas.style.height = "100%";

  // إذا ما تغيّر الحجم ما داعي نعمل reset
  if (canvas.width === pxW && canvas.height === pxH) return false;

  canvas.width = pxW;
  canvas.height = pxH;

  return true;
}

export default function GameCanvas({ level, frame }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);

  // init renderer مرة واحدة
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    rendererRef.current = makeRenderer(canvas);

    const onResize = () => {
      if (!canvasRef.current || !rendererRef.current) return;
      resizeCanvasToContainer(canvasRef.current);
      if (level && frame) rendererRef.current.draw(level, frame);
    };

    window.addEventListener("resize", onResize);

    // أول مرة
    onResize();

    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw لما يتغير level/frame
  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer || !level || !frame) return;

    resizeCanvasToContainer(canvas);
    renderer.draw(level, frame);
  }, [level, frame]);

  return (
    <canvas
      ref={canvasRef}
      tabIndex={0}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 14,
        display: "block",
        outline: "none",
      }}
    />
  );
}
