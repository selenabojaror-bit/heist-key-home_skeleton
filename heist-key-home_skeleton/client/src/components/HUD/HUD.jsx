export default function HUD({ title, timeText, ticks, score, hasKey }) {
  return (
    <div className="hud">
      <div className="hudTitle">{title}</div>

      {/* رح نخفيها في PlayPage ونحط وقت بالنص */}
      <div className="hudTime">⏱ {timeText}</div>

      <div className="hudStat">Ticks: {ticks ?? "—"}</div>
      <div className="hudStat">Score: {score ?? "—"}</div>
      <div className="hudStat">Key: {hasKey ? "✅" : "—"}</div>
    </div>
  );
}
