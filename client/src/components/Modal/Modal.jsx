export default function Modal({
  open,
  title,
  children,
  onClose,
  showClose = true,
  dismissOnOverlay = true,
}) {
  if (!open) return null;

  const handleOverlayClick = () => {
    if (!dismissOnOverlay) return;
    onClose?.();
  };

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 12,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 92vw)",
          background: "rgba(15,18,26,0.95)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 16,
          padding: 18,
          color: "#fff",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 10 }}>
          {title}
        </div>

        {children}

        {showClose && (
          <div style={{ marginTop: 12, textAlign: "right" }}>
            <button
              onClick={() => onClose?.()}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}