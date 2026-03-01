import { ChevronRight, Cpu, Package } from 'lucide-react';
import type { DetectedComponent } from '../../utils/componentMatcher';
import { matchProjects, getChipClass } from '../../utils/componentMatcher';
import type { ProjectMatch } from '../../utils/componentMatcher';

interface ScanResultsProps {
  screenshot: string;
  detected: DetectedComponent[];
  onProjectClick: (projectId: string) => void;
}

export function ScanResults({ screenshot, detected, onProjectClick }: ScanResultsProps) {
  const matches: ProjectMatch[] = matchProjects(detected, 0);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'difficulty-beginner';
      case 'intermediate': return 'difficulty-intermediate';
      case 'advanced': return 'difficulty-advanced';
      default: return '';
    }
  };

  return (
    <div className="scan-results">
      {/* Screenshot section */}
      <div className="scan-results-screenshot">
        <img src={screenshot} alt="Scanned components" />
      </div>

      {/* Detected components */}
      <div className="scan-results-components">
        <div className="scan-results-section-title">
          <Package size={16} />
          Components Found ({detected.length})
        </div>
        <div className="scan-results-tags">
          {detected.map(d => (
            <span key={d.className} className={`scanner-tag ${getChipClass(d.className)}`}>
              {d.className}
            </span>
          ))}
        </div>
      </div>

      {/* Recommended projects */}
      {matches.length > 0 && (
        <div className="scan-results-projects">
          <div className="scan-results-section-title">
            <Cpu size={16} />
            Recommended Projects
          </div>
          <div className="scan-results-project-list">
            {matches.map(m => {
              const isComingSoon = m.project.steps.length === 0;
              return (
                <button
                  key={m.project.id}
                  className={`scan-project-card ${isComingSoon ? 'coming-soon' : ''}`}
                  onClick={() => !isComingSoon && onProjectClick(m.project.id)}
                  disabled={isComingSoon}
                  type="button"
                >
                  <div className={`scan-project-icon ${getDifficultyColor(m.project.difficulty)}`}>
                    <Cpu size={18} />
                  </div>
                  <div className="scan-project-info">
                    <h4>{m.project.title}</h4>
                    <p>{m.project.description}</p>
                    <div className="scan-project-match">
                      {m.matchPercent}% match &middot; {m.matchedComponents.join(', ')}
                    </div>
                  </div>
                  {!isComingSoon && (
                    <div className="scan-project-arrow">
                      <ChevronRight size={16} />
                    </div>
                  )}
                  {isComingSoon && <span className="scan-project-soon">Soon</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {matches.length === 0 && (
        <div className="scan-results-no-match">
          <p>No matching projects found for these components yet.</p>
          <p>Try describing what you'd like to build in the chat below!</p>
        </div>
      )}
    </div>
  );
}
