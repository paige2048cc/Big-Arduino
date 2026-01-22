import { useState } from 'react';
import { BookOpen, MessageSquare, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ProjectStep } from '../../types';
import './RightPanel.css';

type TabType = 'instructions' | 'chat';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RightPanelProps {
  steps: ProjectStep[];
  currentStep: number;
  completedSteps: Set<number>;
  onStepChange: (step: number) => void;
  chatMessages: ChatMessage[];
  onSendMessage: (message: string) => void;
}

export function RightPanel({
  steps,
  currentStep,
  completedSteps,
  onStepChange,
  chatMessages,
  onSendMessage,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('instructions');
  const [chatInput, setChatInput] = useState('');

  const step = steps[currentStep];
  const totalSteps = steps.length;

  const handlePrev = () => {
    if (currentStep > 0) {
      onStepChange(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      onStepChange(currentStep + 1);
    }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    onSendMessage(chatInput);
    setChatInput('');
  };

  return (
    <div className="right-panel-container">
      {/* Tab Switcher */}
      <div className="panel-tabs">
        <button
          className={`panel-tab ${activeTab === 'instructions' ? 'active' : ''}`}
          onClick={() => setActiveTab('instructions')}
        >
          <BookOpen size={16} />
          <span>Instructions</span>
        </button>
        <button
          className={`panel-tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={16} />
          <span>AI Chat</span>
        </button>
      </div>

      {/* Panel Content */}
      <div className="panel-content">
        {activeTab === 'instructions' ? (
          <div className="instructions-content">
            {/* Step Header */}
            <div className="step-header">
              <span className="step-badge">Step {currentStep + 1} of {totalSteps}</span>
              <h2 className="step-title">{step?.title}</h2>
              <p className="step-description">{step?.description}</p>
            </div>

            {/* Progress dots */}
            <div className="step-progress">
              {steps.map((_, index) => (
                <button
                  key={index}
                  className={`progress-dot ${index === currentStep ? 'active' : ''} ${completedSteps.has(index) ? 'completed' : ''}`}
                  onClick={() => onStepChange(index)}
                  title={`Step ${index + 1}`}
                />
              ))}
            </div>

            {/* Instructions List */}
            <div className="instructions-list">
              <h3>Instructions</h3>
              <ol>
                {step?.instructions.map((instruction, index) => (
                  <li key={index}>{instruction}</li>
                ))}
              </ol>
            </div>

            {/* Tips */}
            {step?.tips && step.tips.length > 0 && (
              <div className="tips-box">
                <h4>Tips</h4>
                <ul>
                  {step.tips.map((tip, index) => (
                    <li key={index}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="chat-content">
            <div className="chat-messages">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`chat-message ${msg.role}`}>
                  <div className="message-bubble">{msg.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer - Navigation or Chat Input */}
      {activeTab === 'instructions' ? (
        <div className="step-navigation">
          <button
            className="nav-btn prev"
            onClick={handlePrev}
            disabled={currentStep === 0}
          >
            <ChevronLeft size={18} />
            <span>Previous</span>
          </button>
          <button
            className="nav-btn next"
            onClick={handleNext}
            disabled={currentStep === totalSteps - 1}
          >
            <span>{currentStep === totalSteps - 1 ? 'Complete' : 'Next'}</span>
            {currentStep < totalSteps - 1 && <ChevronRight size={18} />}
          </button>
        </div>
      ) : (
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
      )}
    </div>
  );
}
