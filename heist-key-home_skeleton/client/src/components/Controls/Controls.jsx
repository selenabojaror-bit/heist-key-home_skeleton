import "./Controls.css";

function Key({ onDown, children, wide }) {
  return (
    <button
      className={`keyBtn ${wide ? "wide" : ""}`}
      onPointerDown={(e) => {
        e.preventDefault();
        onDown?.();
      }}
    >
      {children}
    </button>
  );
}

export default function Controls({ onMove }) {
  return (
    <div className="controlsPad">
      <div className="keysGrid">
        <div />
        <Key onDown={() => onMove("U")}>↑</Key>
        <div />

        <Key onDown={() => onMove("L")}>←</Key>
        <Key onDown={() => onMove("D")}>↓</Key>
        <Key onDown={() => onMove("R")}>→</Key>
      </div>
    </div>
  );
}
