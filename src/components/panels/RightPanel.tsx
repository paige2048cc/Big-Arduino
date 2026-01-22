import { useState } from 'react';
import { MessageSquare, Send, ChevronDown, Check } from 'lucide-react';
import type { ProjectStep } from '../../types';
import './RightPanel.css';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RightPanelProps {
  steps: ProjectStep[];
  currentStep: number;
  completedSteps: Set<number>;
  expandedSteps: Set<number>;
  onStepChange: (step: number) => void;
  onToggleExpand: (stepIndex: number) => void;
  onStepComplete: (stepIndex: number) => void;
  chatMessages: ChatMessage[];
  onSendMessage: (message: string) => void;
}

export function RightPanel({
  steps,
  currentStep,
  completedSteps,
  expandedSteps,
  onStepChange: _onStepChange,
  onToggleExpand,
  onStepComplete,
  chatMessages,
  onSendMessage,
}: RightPanelProps) {
  // _onStepChange kept for potential future use (e.g., clicking step header to jump)
  const [chatInput, setChatInput] = useState('');

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    onSendMessage(chatInput);
    setChatInput('');
  };

  const getStepState = (index: number) => {
    if (completedSteps.has(index)) return 'completed';
    if (index === currentStep) return 'active';
    return 'inactive';
  };

  return (
    <div className="right-panel-container">
      {/* Scrollable Content */}
      <div className="panel-content">
        {/* Step Accordion */}
        <div className="step-accordion">
          {steps.map((step, index) => {
            const state = getStepState(index);
            const isExpanded = expandedSteps.has(index);

            return (
              <div
                key={step.id}
                className={`accordion-step ${state}`}
              >
                {/* Accordion Header */}
                <button
                  className="accordion-header"
                  onClick={() => onToggleExpand(index)}
                >
                  <div className="step-indicator">
                    {state === 'completed' ? (
                      <Check size={14} />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <span className="step-title">{step.title}</span>
                  <ChevronDown
                    size={16}
                    className={`chevron ${isExpanded ? 'expanded' : ''}`}
                  />
                </button>

                {/* Accordion Content */}
                {isExpanded && (
                  <div className="accordion-content">
                    <p className="step-description">{step.description}</p>

                    <div className="instructions-list">
                      <h4>Instructions</h4>
                      <ol>
                        {step.instructions.map((instruction, i) => (
                          <li key={i}>{instruction}</li>
                        ))}
                      </ol>
                    </div>

                    {step.tips && step.tips.length > 0 && (
                      <div className="tips-box">
                        <h4>Tips</h4>
                        <ul>
                          {step.tips.map((tip, i) => (
                            <li key={i}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {state === 'active' && (
                      <button
                        className="complete-step-btn"
                        onClick={() => onStepComplete(index)}
                      >
                        <Check size={16} />
                        <span>Mark Complete</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Chat Section */}
        <div className="chat-section">
          <div className="chat-header">
            <MessageSquare size={16} />
            <span>AI Assistant</span>
          </div>
          <div className="chat-messages">
            {chatMessages.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.role}`}>
                <div className="message-bubble">{msg.content}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed Chat Input */}
      <div className="chat-input-container">
        <input
          type="text"
          placeholder="Ask a question..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
        />
        <button onClick={handleSendMessage} disabled={!chatInput.trim()}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
