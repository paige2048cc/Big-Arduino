/**
 * CoachmarkCard Component
 *
 * Displays the onboarding guidance card with title, media placeholder,
 * instructions, and action buttons.
 *
 * Supports 3 variants:
 * - full: Complete card with media placeholder and mascot
 * - no-media: Simplified card without media (for Step 4)
 * - completion: Completion card with dual characters (for Step 5)
 */

import type { CSSProperties } from 'react';
import type { OnboardingPhase, OnboardingStepConfig } from '../../types/onboarding';
import './CoachmarkCard.css';

interface CoachmarkCardProps {
  config: OnboardingStepConfig;
  phase: OnboardingPhase;
  onSkip: () => void;
  onComplete: () => void;
  onReplay?: () => void;
  style?: CSSProperties;
  isTransitioning?: boolean;
}

// Blue mascot character SVG
function BlueMascotCharacter({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="80"
      height="80"
      viewBox="295 175 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Body */}
      <path
        d="M359.83 241.079C365.229 236.172 358.91 229.73 355.076 227.123C364.646 226.509 368.026 220.335 367.805 217.308C367.039 206.762 354.514 206.981 348.941 208.106C352.622 204.731 356.15 181.113 348.941 180.04C342.877 179.136 336.162 193.972 334.822 198.248C334.56 194.014 330.396 179.454 325.016 180.04C319.824 180.604 320.355 194.93 321.949 202.431L319.802 200.131C315.15 196.45 305.504 190.862 301.705 196.45C296.814 203.643 315.674 217.135 315.201 217.308C314.279 217.644 310.907 218.841 309.373 219.608C306.357 221.551 299.606 226.887 300.018 232.644C300.442 238.583 309.441 236.795 313.054 234.945L313.052 234.947C311.269 237.636 306.594 244.687 310.907 249.514C316.822 256.137 327.163 238.472 327.163 238.472C327.163 238.472 331.534 251.355 336.365 249.514C341.196 247.674 340.762 241.13 340.66 236.785C344.8 240.261 354.432 245.987 359.83 241.079Z"
        fill="#1A2BC3"
      />
      {/* Left eye white */}
      <ellipse
        cx="339.981"
        cy="215.505"
        rx="4.371"
        ry="5.138"
        fill="#FDFCFC"
      />
      {/* Left eye pupil */}
      <circle cx="339.981" cy="215.505" r="2.3" fill="black" />
      {/* Right eye white */}
      <ellipse
        cx="325.564"
        cy="213.357"
        rx="4.371"
        ry="5.138"
        fill="#FDFCFC"
      />
      {/* Right eye pupil */}
      <circle cx="325.564" cy="213.357" r="2.3" fill="black" />
      {/* Mouth */}
      <path
        d="M333.769 216.424C333.59 217.038 332.916 217.92 332.082 217.92C331.123 217.92 330.931 216.833 330.778 216.424"
        stroke="white"
        strokeWidth="0.92"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Yellow mascot character SVG
function YellowMascotCharacter({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="68"
      height="71"
      viewBox="0 0 68 71"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
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
      {/* Pupils */}
      <circle cx="39.981" cy="35.505" r="2.3" fill="black" />
      <circle cx="25.564" cy="33.357" r="2.3" fill="black" />
      <path
        d="M33.769 36.4243C33.5901 37.0378 32.9164 37.9196 32.082 37.9196C31.1235 37.9196 30.9317 36.8333 30.7784 36.4243"
        stroke="black"
        strokeWidth="0.920197"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CoachmarkCard({
  config,
  phase,
  onSkip,
  onComplete,
  onReplay,
  style,
  isTransitioning,
}: CoachmarkCardProps) {
  const isCongratsPhase = phase === 'component-dropped' && config.id === 'toolbar-introduction';
  const isCompletionStep = config.cardVariant === 'completion';
  const isNoMediaVariant = config.cardVariant === 'no-media';

  // Determine button text
  const getPrimaryButtonText = () => {
    // Step 1 congrats phase shows "Next"
    if (isCongratsPhase) {
      return 'Next';
    }
    return config.primaryButtonText;
  };

  // Determine title
  const getTitle = () => {
    if (isCongratsPhase && config.congratsTitle) {
      return config.congratsTitle;
    }
    return config.title;
  };

  // Determine body
  const getBody = () => {
    if (isCongratsPhase && config.congratsBody) {
      return config.congratsBody;
    }
    return config.body;
  };

  const cardClassName = [
    'coachmark-card',
    isCompletionStep ? 'coachmark-card--completion' : '',
    isNoMediaVariant ? 'coachmark-card--no-media' : '',
    isTransitioning ? 'coachmark-card--transitioning' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cardClassName}
      role="dialog"
      aria-labelledby="coachmark-title"
      aria-describedby="coachmark-body"
      style={style}
    >
      {/* Completion variant: dual characters at top */}
      {isCompletionStep && (
        <div className="coachmark-completion-characters">
          <BlueMascotCharacter className="coachmark-completion-blue" />
          <YellowMascotCharacter className="coachmark-completion-yellow" />
        </div>
      )}

      {/* Media placeholder with mascot (full variant only) */}
      {config.cardVariant === 'full' && (
        <div className="coachmark-media">
          <div className="coachmark-media-placeholder">
            {isCongratsPhase ? (
              <div className="coachmark-congrats-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="#34A853" />
                  <path
                    d="M8 12l2.5 2.5L16 9"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            ) : (
              <div className="coachmark-video-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z"
                    fill="#5f6368"
                  />
                </svg>
              </div>
            )}
          </div>
          {/* Mascot character - positioned at bottom-right of media */}
          <BlueMascotCharacter className="coachmark-mascot" />
        </div>
      )}

      {/* Content */}
      <div className="coachmark-content">
        <h2 id="coachmark-title" className="coachmark-title">
          {getTitle()}
        </h2>

        {!isCongratsPhase && !isCompletionStep && config.subtitle && (
          <p className="coachmark-subtitle">{config.subtitle}</p>
        )}

        {getBody() && (
          <p id="coachmark-body" className="coachmark-body">
            {getBody()}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="coachmark-footer">
        <span className="coachmark-step-indicator">
          {config.stepNumber}/{config.totalSteps}
        </span>

        <div className="coachmark-actions">
          {isCompletionStep ? (
            // Completion step: Replay / Done
            <>
              <button
                className="coachmark-btn coachmark-btn--skip"
                onClick={onReplay}
                type="button"
              >
                Replay
              </button>
              <button
                className="coachmark-btn coachmark-btn--primary"
                onClick={onComplete}
                type="button"
                autoFocus
              >
                {getPrimaryButtonText()}
              </button>
            </>
          ) : isCongratsPhase ? (
            // Congrats phase (Step 1 after drop): Next button only
            <button
              className="coachmark-btn coachmark-btn--primary"
              onClick={onComplete}
              type="button"
              autoFocus
            >
              {getPrimaryButtonText()}
            </button>
          ) : (
            // Normal steps: Skip / Primary
            <>
              {config.showSkip && (
                <button
                  className="coachmark-btn coachmark-btn--skip"
                  onClick={onSkip}
                  type="button"
                >
                  Skip
                </button>
              )}
              <button
                className="coachmark-btn coachmark-btn--primary"
                onClick={onComplete}
                type="button"
              >
                {getPrimaryButtonText()}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
