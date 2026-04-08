import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Camera, ChevronRight } from 'lucide-react';
import { presetProjects } from '../data/projects';
import { Sidebar } from '../components/layout/Sidebar';
import { ComponentScanner } from '../components/scanner/ComponentScanner';
import type { DetectedComponent } from '../utils/componentMatcher';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type EyeRefs = {
  socket: RefObject<HTMLDivElement | null>;
  pupil: RefObject<HTMLDivElement | null>;
};

function getProjectPreviewAssets(projectId: string) {
  switch (projectId) {
    case 'led-button':
      return [];
    case 'buzzer-button':
      return [];
    case 'plant-monitor':
      return [];
    default:
      return [{ src: '/components/microcontrollers/arduino-uno.png', className: 'home-project-preview--uno' }];
  }
}

export function HomePage() {
  const [ideaInput, setIdeaInput] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const navigate = useNavigate();

  const blueEye1SocketRef = useRef<HTMLDivElement>(null);
  const blueEye1PupilRef = useRef<HTMLDivElement>(null);
  const blueEye2SocketRef = useRef<HTMLDivElement>(null);
  const blueEye2PupilRef = useRef<HTMLDivElement>(null);

  const yellowEye1SocketRef = useRef<HTMLDivElement>(null);
  const yellowEye1PupilRef = useRef<HTMLDivElement>(null);
  const yellowEye2SocketRef = useRef<HTMLDivElement>(null);
  const yellowEye2PupilRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = () => {
    const text = ideaInput.trim();
    if (!text) return;

    // Navigate to ai-chat page with the initial message
    navigate('/ai-chat', { state: { initialMessage: text } });
  };

  const handlePresetProject = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  const handleScanComplete = (detected: DetectedComponent[], screenshot: string) => {
    setScannerOpen(false);
    navigate('/ai-chat', { state: { detected, screenshot } });
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
        <Sidebar />

        <ComponentScanner
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onComplete={handleScanComplete}
        />

        {/* Main */}
        <main className="home-main">
          <div className="home-main-inner">
            {/* Hero Section */}
            <section className="home-hero-card" aria-label="Start a new project">
              <div className="home-hero-characters" aria-hidden="true">
                  {/* Blue character */}
                  <div className="home-character home-character-blue">
                    <svg className="home-character-blob" viewBox="0 0 202 196" fill="none" xmlns="http://www.w3.org/2000/svg" role="presentation" preserveAspectRatio="none">
                      <path
                        d="M34.0127 168.938C20.0022 156.201 32.6245 129.001 42.5752 122.234C17.7384 120.642 -0.558467 96.7956 0.0130253 88.9377C2.00315 61.5704 44.0345 69.9602 58.4961 72.8791C48.9435 64.1225 39.7889 19.7237 58.4961 16.9375C77.2033 14.1513 92.5127 39.9376 95.5124 50.1916C96.4738 53.4778 104.583 -1.70094 120.588 0.040376C134.064 1.50659 132.685 38.6855 128.549 58.1521L139.013 50.1916C155.013 37.6916 195.013 26.9375 200.513 42.9377C204.308 53.9785 194.995 67.6942 180.013 78.4376C164.864 89.2997 145.445 96.5353 146.062 96.7606C148.455 97.6341 166.533 101.948 170.513 103.938C181.013 109.188 204.084 116.773 200.513 133.438C197.513 147.438 161.01 147.336 151.634 142.533C156.258 149.506 171.709 179.904 160.513 192.438C145.16 209.625 115.016 151.688 115.016 151.688C115.016 151.688 108.05 191.214 95.5124 186.438C82.9746 181.661 79.7241 158.587 79.9894 147.31C73.0127 162.938 48.0232 181.674 34.0127 168.938Z"
                        fill="#1A2BC3"
                      />
                      <path
                        d="M97.5127 106.663C97.9771 108.255 99.7255 110.544 101.891 110.544C104.379 110.544 104.876 107.724 105.274 106.663"
                        stroke="white"
                        strokeWidth="2.38815"
                        strokeLinecap="round"
                      />
                      <ellipse cx="81.7539" cy="100.844" rx="11.3437" ry="13.3339" fill="#FDFCFC" />
                      <ellipse cx="119.169" cy="95.2713" rx="11.3437" ry="13.3339" fill="#FDFCFC" />
                      <ellipse cx="73.0127" cy="118.938" rx="13.5" ry="13" fill="url(#homeBlueBlush1)" />
                      <ellipse cx="133.013" cy="108.938" rx="13.5" ry="13" fill="url(#homeBlueBlush2)" />
                      <defs>
                        <radialGradient id="homeBlueBlush1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(73.0127 118.938) rotate(90) scale(13 13.5)">
                          <stop stopColor="#D74040" />
                          <stop offset="1" stopColor="#D9D9D9" stopOpacity="0" />
                        </radialGradient>
                        <radialGradient id="homeBlueBlush2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(133.013 108.938) rotate(90) scale(13 13.5)">
                          <stop stopColor="#D74040" />
                          <stop offset="1" stopColor="#D9D9D9" stopOpacity="0" />
                        </radialGradient>
                      </defs>
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
                    <svg className="home-character-blob" viewBox="0 0 195 187" fill="none" xmlns="http://www.w3.org/2000/svg" role="presentation" preserveAspectRatio="none">
                      <path
                        d="M169.269 178.5C183.28 165.763 161.506 129.001 151.555 122.234C176.392 120.642 195.43 107 194.118 88.9377C192.127 61.5704 150.096 69.9602 135.635 72.8791C145.187 64.1225 162.269 18.0002 135.635 18.0005C116.721 18.0007 101.618 39.9376 98.6182 50.1916C97.6568 53.4778 89.5472 -1.70094 73.5425 0.040376C60.0663 1.50659 61.4455 38.6855 65.5819 58.1521C65.5819 58.1521 57.2693 49.0005 42.7693 39.5005C28.2693 30.0005 10.7693 33.5005 3.76926 42.0005C-3.23074 50.5005 -0.864807 67.6941 14.1179 78.4376C29.2661 89.2997 48.6859 96.5353 48.0689 96.7606C45.676 97.6341 27.5979 101.948 23.6176 103.938C13.1176 109.188 -2.80183 115.335 0.769257 132C3.76926 146 33.1205 147.336 42.4965 142.533C37.873 149.506 24.5734 170.466 35.7693 183C51.1216 200.187 79.1149 151.688 79.1149 151.688C79.1149 151.688 86.0804 191.214 98.6182 186.437C111.156 181.661 114.407 158.587 114.141 147.31C121.118 162.937 155.259 191.237 169.269 178.5Z"
                        fill="#FFC425"
                      />
                      <path
                        d="M96.6172 106.664C96.1528 108.256 94.4044 110.544 92.2389 110.544C89.7512 110.544 89.2537 107.725 88.8557 106.664"
                        stroke="black"
                        strokeWidth="2.38815"
                        strokeLinecap="round"
                      />
                      <ellipse cx="11.3437" cy="13.3339" rx="11.3437" ry="13.3339" transform="matrix(-1 0 0 1 123.72 87.5107)" fill="#FDFCFC" />
                      <ellipse cx="11.3437" cy="13.3339" rx="11.3437" ry="13.3339" transform="matrix(-1 0 0 1 86.3047 81.938)" fill="#FDFCFC" />
                      <ellipse cx="59.2686" cy="106" rx="13.5" ry="13" fill="url(#homeYellowBlush1)" />
                      <ellipse cx="123.269" cy="117" rx="13.5" ry="13" fill="url(#homeYellowBlush2)" />
                      <defs>
                        <radialGradient id="homeYellowBlush1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(59.2686 106) rotate(90) scale(13 13.5)">
                          <stop offset="0.0769231" stopColor="#FF6062" />
                          <stop offset="1" stopColor="#D9D9D9" stopOpacity="0" />
                        </radialGradient>
                        <radialGradient id="homeYellowBlush2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(123.269 117) rotate(90) scale(13 13.5)">
                          <stop offset="0.134615" stopColor="#FF6062" />
                          <stop offset="1" stopColor="#D9D9D9" stopOpacity="0" />
                        </radialGradient>
                      </defs>
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
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="home-idea-field"
                  />
                  <button
                    className="home-idea-camera"
                    onClick={() => setScannerOpen(true)}
                    aria-label="Scan components with camera"
                    type="button"
                    title="Scan components"
                  >
                    <Camera size={18} />
                  </button>
                  <button
                    className="home-idea-send"
                    onClick={handleSendMessage}
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
                  const difficultyLabel = project.difficulty.toUpperCase();
                  const previewAssets = getProjectPreviewAssets(project.id);

                  return (
                    <button
                      key={project.id}
                      className={`home-project-card ${isComingSoon ? 'coming-soon' : ''}`}
                      onClick={() => !isComingSoon && handlePresetProject(project.id)}
                      disabled={isComingSoon}
                      type="button"
                    >
                      <div className={`home-project-visual home-project-visual--${project.id}`} aria-hidden="true">
                        <span className={`home-project-badge home-project-badge--${project.difficulty}`}>{difficultyLabel}</span>
                        {previewAssets.map((asset) => (
                          <img
                            key={`${project.id}-${asset.className}`}
                            src={asset.src}
                            alt=""
                            className={`home-project-preview ${asset.className}`}
                            loading="lazy"
                          />
                        ))}
                      </div>

                      <div className="home-project-body">
                        <h3>{project.title}</h3>
                      </div>
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
