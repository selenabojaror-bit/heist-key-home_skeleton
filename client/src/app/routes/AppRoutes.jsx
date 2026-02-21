import { Navigate, Route, Routes } from "react-router-dom";
import CoverPage from "../../pages/CoverPage/CoverPlayPage";
import LevelsPage from "../../pages/LevelsPage/LevelsPage";
import PlayPage from "../../pages/PlayPage/PlayPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<CoverPage />} />
      <Route path="/levels" element={<LevelsPage />} />
      <Route path="/play/:levelId" element={<PlayPage />} />

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}