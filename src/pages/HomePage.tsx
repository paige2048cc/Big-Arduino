import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Zap, ChevronRight, Home, Folder, BookOpen, Users, Menu, Settings, Cpu } from 'lucide-react';
import { presetProjects } from '../data/projects';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type EyeRefs = {
  socket: RefObject<HTMLDivElement | null>;
  pupil: RefObject<HTMLDivElement | null>;
};

export function HomePage() {
  const [ideaInput, setIdeaInput] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const navigate = useNavigate();

  const blueEye1SocketRef = useRef<HTMLDivElement>(null);
  const blueEye1PupilRef = useRef<HTMLDivElement>(null);
  const blueEye2SocketRef = useRef<HTMLDivElement>(null);
  const blueEye2PupilRef = useRef<HTMLDivElement>(null);

  const yellowEye1SocketRef = useRef<HTMLDivElement>(null);
  const yellowEye1PupilRef = useRef<HTMLDivElement>(null);
  const yellowEye2SocketRef = useRef<HTMLDivElement>(null);
  const yellowEye2PupilRef = useRef<HTMLDivElement>(null);

  const handleCustomProject = () => {
    if (ideaInput.trim()) {
      // For MVP, redirect to a custom project page with the idea
      navigate(`/project/custom?idea=${encodeURIComponent(ideaInput)}`);
    }
  };

  const handlePresetProject = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'difficulty-beginner';
      case 'intermediate': return 'difficulty-intermediate';
      case 'advanced': return 'difficulty-advanced';
      default: return '';
    }
  };

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    const eyes: EyeRefs[] = [
      { socket: blueEye1SocketRef, pupil: blueEye1PupilRef },
      { socket: blueEye2SocketRef, pupil: blueEye2PupilRef },
      { socket: yellowEye1SocketRef, pupil: yellowEye1PupilRef },
      { socket: yellowEye2SocketRef, pupil: yellowEye2PupilRef },
    ];
    let rafId: number | null = null;
    let lastX = 0;
    let lastY = 0;

    const updateEyes = () => {
      rafId = null;

      for (const eye of eyes) {
        const socketEl = eye.socket.current;
        const pupilEl = eye.pupil.current;
        if (!socketEl || !pupilEl) continue;

        const rect = socketEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = lastX - cx;
        const dy = lastY - cy;
        const dist = Math.hypot(dx, dy);

        // Keep movement subtle to avoid stealing attention.
        const pupilSize = Math.min(rect.width, rect.height) * 0.45;
        const maxOffset = Math.max(0, (Math.min(rect.width, rect.height) - pupilSize) / 2 - 1);
        const move = prefersReducedMotion ? 0 : clamp(dist * 0.04, 0, maxOffset);
        const angle = Math.atan2(dy, dx);

        const ox = Math.cos(angle) * move;
        const oy = Math.sin(angle) * move;

        pupilEl.style.transform = `translate(${ox.toFixed(2)}px, ${oy.toFixed(2)}px)`;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (rafId != null) return;
      rafId = window.requestAnimationFrame(updateEyes);
    };

    const resetEyes = () => {
      if (rafId != null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      for (const eye of eyes) {
        const pupilEl = eye.pupil.current;
        if (!pupilEl) continue;
        pupilEl.style.transform = 'translate(0px, 0px)';
      }
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('blur', resetEyes);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('blur', resetEyes);
      if (rafId != null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="home-page">
      <div className="home-shell">
        {/* Sidebar (visual only) */}
        <aside className={`home-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`} aria-label="Primary navigation">
          <div className="sidebar-header">
            <button
              className="sidebar-brand-toggle"
              type="button"
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Brand'}
              tabIndex={isSidebarCollapsed ? 0 : -1}
              onClick={() => isSidebarCollapsed && toggleSidebar()}
            >
              <span className="sidebar-brand-iconSwap" aria-hidden="true">
                <Zap size={22} className="sidebar-brand-icon sidebar-brand-icon--zap" />
                <Menu size={20} className="sidebar-brand-icon sidebar-brand-icon--menu" />
              </span>
              <span className="sidebar-brand-text">Big Arduino</span>
            </button>

            <button
              className="sidebar-menu-button"
              type="button"
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={toggleSidebar}
            >
              <Menu size={20} />
            </button>
          </div>

          <nav className="sidebar-nav">
            <button className="sidebar-nav-item active" type="button" data-label="Home" aria-label="Home">
              <Home size={18} />
              <span>Home</span>
            </button>
            <button className="sidebar-nav-item" type="button" data-label="Projects" aria-label="Projects">
              <Folder size={18} />
              <span>Projects</span>
            </button>
            <button className="sidebar-nav-item" type="button" data-label="Learn" aria-label="Learn">
              <BookOpen size={18} />
              <span>Learn</span>
            </button>
            <button className="sidebar-nav-item" type="button" data-label="Community" aria-label="Community">
              <Users size={18} />
              <span>Community</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-avatar" aria-hidden="true">JD</div>
              <div className="sidebar-user-meta">
                <div className="sidebar-user-name">John Doe</div>
                <div className="sidebar-user-plan">Free Plan</div>
              </div>
            </div>
            <button className="sidebar-settings-button" type="button" aria-label="Settings">
              <Settings size={18} />
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="home-main">
          <div className="home-main-inner">
            {/* Hero */}
            <section className="home-hero-card" aria-label="Start a new project">
              <div className="home-hero-characters" aria-hidden="true">
                {/* Blue character */}
                <div className="home-character home-character-blue">
                  <svg className="home-character-blob" viewBox="0 0 106 111" fill="none" xmlns="http://www.w3.org/2000/svg" role="presentation">
                    <path
                      d="M12.4812 95.4703C4.04302 87.7992 13.9195 77.731 19.9125 73.6558C4.954 72.6969 -0.328517 63.0463 0.0156772 58.3137C1.21428 41.8311 20.7914 42.1726 29.5012 43.9305C23.7479 38.6567 18.2344 1.73981 29.5012 0.0617645C38.9798 -1.34995 49.4765 21.8397 51.5705 28.5226C51.9803 21.9041 58.4883 -0.853159 66.8975 0.0617645C75.0138 0.944824 74.1832 23.3367 71.6919 35.0609L75.048 31.4651C82.3195 25.7118 97.3965 16.9778 103.335 25.7118C110.979 36.9545 81.5004 58.0439 82.2396 58.3137C83.6808 58.8398 88.9517 60.7109 91.3489 61.9095C96.0634 64.946 106.615 73.287 105.972 82.2857C105.308 91.568 91.2426 88.7737 85.5957 85.8815L85.5985 85.8857C88.3852 90.0885 95.6924 101.109 88.9517 108.655C79.7054 119.006 63.5414 91.3951 63.5414 91.3951C63.5414 91.3951 56.7094 111.532 49.1582 108.655C41.6071 105.778 42.2863 95.5502 42.4461 88.7581C35.9737 94.1918 20.9193 103.141 12.4812 95.4703Z"
                      fill="#1A2BC3"
                    />
                    <ellipse cx="43.5088" cy="55.4955" rx="6.83202" ry="8.03061" fill="#FDFCFC" />
                    <ellipse cx="66.043" cy="52.139" rx="6.83202" ry="8.03061" fill="#FDFCFC" />
                    <path
                      d="M53.2178 56.9336C53.4974 57.8925 54.5505 59.2709 55.8547 59.2709C57.3529 59.2709 57.6526 57.5728 57.8923 56.9336"
                      stroke="white"
                      strokeWidth="1.43832"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="home-character-eye eye-1" ref={blueEye1SocketRef}>
                    <div className="home-character-pupil" ref={blueEye1PupilRef} />
                  </div>
                  <div className="home-character-eye eye-2" ref={blueEye2SocketRef}>
                    <div className="home-character-pupil" ref={blueEye2PupilRef} />
                  </div>
                </div>

                {/* Yellow character */}
                <div className="home-character home-character-yellow">
                  <svg className="home-character-blob" viewBox="0 0 68 71" fill="none" xmlns="http://www.w3.org/2000/svg" role="presentation">
                    <path
                      d="M59.8308 61.0793C65.2293 56.1716 58.9106 49.7302 55.0764 47.1229C64.6465 46.5095 68.0261 40.3353 67.8059 37.3075C67.039 26.7624 54.5141 26.9809 48.9418 28.1056C52.6226 24.7315 56.15 1.11308 48.9418 0.0395152C42.8777 -0.863662 36.1622 13.9725 34.8225 18.248C34.5603 14.0137 30.3967 -0.545828 25.0167 0.0395152C19.8241 0.604472 20.3555 14.9302 21.9494 22.431L19.8022 20.1305C15.1501 16.4497 5.5043 10.862 1.70503 16.4497C-3.18554 23.6425 15.6742 37.1349 15.2013 37.3075C14.2792 37.6441 10.907 38.8412 9.37334 39.608C6.35714 41.5506 -0.3936 46.887 0.0180054 52.6441C0.442589 58.5827 9.44141 56.795 13.0541 54.9446L13.0523 54.9474C11.2694 57.6362 6.59451 64.6866 10.907 69.5144C16.8226 76.1368 27.1638 58.472 27.1638 58.472C27.1638 58.472 31.5348 71.3548 36.3658 69.5144C41.1968 67.674 40.7623 61.1304 40.66 56.785C44.8009 60.2613 54.4323 65.987 59.8308 61.0793Z"
                      fill="#FFC425"
                    />
                    <ellipse
                      cx="4.37094"
                      cy="5.13777"
                      rx="4.37094"
                      ry="5.13777"
                      transform="matrix(-1 0 0 1 44.352 30.3667)"
                      fill="#FDFCFC"
                    />
                    <ellipse
                      cx="4.37094"
                      cy="5.13777"
                      rx="4.37094"
                      ry="5.13777"
                      transform="matrix(-1 0 0 1 29.935 28.2192)"
                      fill="#FDFCFC"
                    />
                    <path
                      d="M33.769 36.4243C33.5901 37.0378 32.9164 37.9196 32.082 37.9196C31.1235 37.9196 30.9317 36.8333 30.7784 36.4243"
                      stroke="black"
                      strokeWidth="0.920197"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="home-character-eye eye-1" ref={yellowEye1SocketRef}>
                    <div className="home-character-pupil" ref={yellowEye1PupilRef} />
                  </div>
                  <div className="home-character-eye eye-2" ref={yellowEye2SocketRef}>
                    <div className="home-character-pupil" ref={yellowEye2PupilRef} />
                  </div>
                </div>
              </div>

              <div className="home-hero-content">
                <div className="home-hero-title">
                  <h1>What will you create today?</h1>
                </div>
                <p className="home-hero-subtitle">
                  Describe your idea and our AI will help you plan the circuit, write the code, and simulate it instantly.
                </p>

                <div className="home-idea-input">
                  <input
                    type="text"
                    placeholder="e.g., 'A plant watering reminder with LED indicators'"
                    value={ideaInput}
                    onChange={(e) => setIdeaInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomProject()}
                    className="home-idea-field"
                  />
                  <button
                    className="home-idea-send"
                    onClick={handleCustomProject}
                    disabled={!ideaInput.trim()}
                    aria-label="Send idea"
                    type="button"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </section>

            {/* Featured Projects */}
            <section className="home-featured" aria-label="Featured projects">
              <div className="home-featured-header">
                <h2>Featured Projects</h2>
                <button className="home-featured-viewall" type="button">
                  View All <ChevronRight size={16} />
                </button>
              </div>

              <div className="home-featured-grid">
                {presetProjects.slice(0, 3).map((project) => {
                  const isComingSoon = project.steps.length === 0;
                  const difficultyClass = getDifficultyColor(project.difficulty);
                  const difficultyLabel = project.difficulty.toUpperCase();

                  return (
                    <button
                      key={project.id}
                      className={`home-project-card ${isComingSoon ? 'coming-soon' : ''}`}
                      onClick={() => !isComingSoon && handlePresetProject(project.id)}
                      disabled={isComingSoon}
                      type="button"
                    >
                      <div className={`home-project-icon ${difficultyClass}`} aria-hidden="true">
                        <Cpu size={22} />
                      </div>

                      <div className="home-project-body">
                        <span className={`home-project-badge ${difficultyClass}`}>{difficultyLabel}</span>
                        <h3>{project.title}</h3>
                        <p>{project.description}</p>
                        {!isComingSoon && (
                          <div className="home-project-action">
                            Start Building <ChevronRight size={16} />
                          </div>
                        )}
                      </div>

                      {isComingSoon && <div className="home-project-soon">Soon</div>}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
