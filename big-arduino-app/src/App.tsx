import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { ProjectPage } from './pages/ProjectPage';
import { AIChatPage } from './pages/AIChatPage';
import { DevPanel } from './components/shared/DevPanel';
import './App.css';

// Use base path for GitHub Pages deployment
const basename = import.meta.env.BASE_URL;

function App() {
  return (
    <Router basename={basename}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/project/:projectId" element={<ProjectPage />} />
        <Route path="/ai-chat" element={<AIChatPage />} />
      </Routes>
      <DevPanel />
    </Router>
  );
}

export default App;
