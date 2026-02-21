import { useNavigate } from "react-router-dom";
import "./CoverPlayPage.css";

export default function CoverPlayPage() {
  const nav = useNavigate();

  return (
    <div className="coverPage">
      <div className="coverCard">
        <img
          className="coverImg"
          src="/assets/cover-play/cover.png"
          alt="Cover"
          draggable={false}
        />

        {/* ✅ زر شفاف فوق زر PLAY اللي جوّا الصورة */}
        <button
          className="playHotspot"
          onClick={() => nav("/levels")}
          aria-label="Play"
        />
      </div>
    </div>
  );
}