import { HashRouter as Router, Routes, Route } from "react-router-dom";
import RoleSelect from "@/pages/RoleSelect";
import KidVideoList from "@/pages/KidVideoList";
import VideoPlay from "@/pages/VideoPlay";
import ParentLogin from "@/pages/ParentLogin";
import ParentDashboard from "@/pages/ParentDashboard";
import UploadVideo from "@/pages/UploadVideo";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RoleSelect />} />
        <Route path="/kid" element={<KidVideoList />} />
        <Route path="/kid/video/:id" element={<VideoPlay />} />
        <Route path="/parent/login" element={<ParentLogin />} />
        <Route path="/parent/dashboard" element={<ParentDashboard />} />
        <Route path="/parent/upload" element={<UploadVideo />} />
      </Routes>
    </Router>
  );
}
