import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Zap, Clock, ChevronRight } from 'lucide-react';
import { presetProjects } from '../data/projects';

export function HomePage() {
  const [ideaInput, setIdeaInput] = useState('');
  const navigate = useNavigate();

  const handleCustomProject = () => {
    if (ideaInput.trim()) {
      // For MVP, redirect to a custom project page with the idea
      navigate(`/project/custom?idea=${encodeURIComponent(ideaInput)}`);
    }
  };

  const handlePresetProject = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  const getDifficultyStars = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '⭐';
      case 'intermediate': return '⭐⭐';
      case 'advanced': return '⭐⭐⭐';
      default: return '⭐';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'difficulty-beginner';
      case 'intermediate': return 'difficulty-intermediate';
      case 'advanced': return 'difficulty-advanced';
      default: return '';
    }
  };

  return (
    <div className="home-page">
      {/* Header */}
      <header className="home-header">
        <div className="logo">
          <Zap size={32} />
          <h1>Big Arduino</h1>
        </div>
        <p className="tagline">Create with AI. Build with confidence.</p>
      </header>

      {/* AI Chat Input */}
      <section className="idea-section">
        <h2>What do you want to create today?</h2>
        <div className="idea-input-container">
          <input
            type="text"
            placeholder="Describe your idea... (e.g., 'A plant watering reminder')"
            value={ideaInput}
            onChange={(e) => setIdeaInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomProject()}
            className="idea-input"
          />
          <button
            className="idea-submit"
            onClick={handleCustomProject}
            disabled={!ideaInput.trim()}
          >
            <Send size={20} />
          </button>
        </div>
        <p className="idea-hint">
          Tell me your idea and I'll help you plan and build it step by step!
        </p>
      </section>

      {/* Divider */}
      <div className="divider">
        <span>Or choose a preset project</span>
      </div>

      {/* Project Cards */}
      <section className="projects-section">
        <div className="projects-grid">
          {presetProjects.map((project) => (
            <div
              key={project.id}
              className={`project-card ${project.steps.length === 0 ? 'coming-soon' : ''}`}
              onClick={() => project.steps.length > 0 && handlePresetProject(project.id)}
            >
              <div className="project-image">
                {/* Placeholder gradient for now */}
                <div className={`project-image-placeholder ${getDifficultyColor(project.difficulty)}`}>
                  <Zap size={48} />
                </div>
                {project.steps.length === 0 && (
                  <div className="coming-soon-badge">Coming Soon</div>
                )}
              </div>
              <div className="project-info">
                <h3>{project.title}</h3>
                <p>{project.description}</p>
                <div className="project-meta">
                  <span className={`difficulty ${getDifficultyColor(project.difficulty)}`}>
                    {getDifficultyStars(project.difficulty)} {project.difficulty}
                  </span>
                  <span className="duration">
                    <Clock size={14} />
                    {project.estimatedTime}
                  </span>
                </div>
                {project.steps.length > 0 && (
                  <button className="start-button">
                    Start Project <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <p>Built for learning physical computing with AI assistance</p>
      </footer>
    </div>
  );
}
