import { useRef } from 'react';
import { MessageSquare, Send, ChevronDown, Check } from 'lucide-react';
import type { ProjectStep } from '../../types';
import type { ChatReference, HighlightItem } from '../../types/chat';
import { usePendingReferences, useCircuitStore } from '../../store/circuitStore';
import { ReferenceTag } from '../chat/ReferenceTag';
import { ChatInputField } from '../chat/ChatInputField';
import type { ChatInputFieldHandle } from '../chat/ChatInputField';
import { ClickableIssue, parseIssuesFromResponse } from '../chat/ClickableIssue';
import './RightPanel.css';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  references?: ChatReference[];
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
  onSendMessage: (message: string, references?: ChatReference[]) => void;
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
  const chatInputRef = useRef<ChatInputFieldHandle>(null);

  // Get pending references from store
  const pendingReferences = usePendingReferences();
  const { confirmReferences, removeReference, clearReferences, setInputFocused, setHighlights, clearHighlights } = useCircuitStore();

  // Handle clicking on an issue to highlight affected items
  const handleViewIssue = (affectedIds: string[]) => {
    // Create highlight items from the affected IDs
    const highlights: HighlightItem[] = affectedIds.map(id => ({
      type: id.toLowerCase().startsWith('wire') ? 'wire' : 'component',
      id,
      severity: 'error' as const,
    }));
    setHighlights(highlights);

    // Clear highlights after 5 seconds
    setTimeout(() => {
      clearHighlights();
    }, 5000);
  };

  // Handle send from ChatInputField
  const handleSendFromInput = (text: string) => {
    if (!text.trim() && pendingReferences.length === 0) return;

    // Collect confirmed references to send with message
    const referencesToSend = pendingReferences.map(pr => pr.reference);

    onSendMessage(text, referencesToSend.length > 0 ? referencesToSend : undefined);
    clearReferences();
  };

  // Handle send button click
  const handleSendClick = () => {
    chatInputRef.current?.triggerSend();
  };

  // Handle input focus - confirm pending references
  const handleInputFocus = () => {
    setInputFocused(true);
    confirmReferences();
  };

  // Handle input blur
  const handleInputBlur = () => {
    setInputFocused(false);
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
            {chatMessages.map((msg, index) => {
              // For assistant messages, try to parse issues
              if (msg.role === 'assistant') {
                const { issues } = parseIssuesFromResponse(msg.content);

                if (issues.length > 0) {
                  return (
                    <div key={index} className="chat-message assistant">
                      <div className="message-bubble">
                        {/* Show the message content */}
                        <p className="message-text">{msg.content.split(/\[\d+\]/)[0].trim()}</p>
                        {/* Show clickable issues */}
                        <div className="message-issues">
                          {issues.map((issue) => (
                            <ClickableIssue
                              key={issue.id}
                              issue={issue}
                              onView={handleViewIssue}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }
              }

              // For user messages with references, show tags inline with text
              if (msg.role === 'user' && msg.references && msg.references.length > 0) {
                return (
                  <div key={index} className="chat-message user">
                    <div className="message-bubble">
                      {msg.references.map((ref, refIndex) => {
                        let key: string;
                        if (ref.type === 'single') {
                          key = ref.instanceId;
                        } else if (ref.type === 'wire') {
                          key = ref.wireId;
                        } else {
                          key = `multi-${refIndex}`;
                        }
                        return (
                          <ReferenceTag
                            key={key}
                            reference={ref}
                            confirmed={true}
                            showRemoveButton={false}
                          />
                        );
                      })}
                      {msg.content && <span className="message-text-content">{msg.content}</span>}
                    </div>
                  </div>
                );
              }

              return (
                <div key={index} className={`chat-message ${msg.role}`}>
                  <div className="message-bubble">{msg.content}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fixed Chat Input */}
      <div className="chat-input-container">
        <div className="chat-input-row">
          <ChatInputField
            ref={chatInputRef}
            pendingReferences={pendingReferences}
            onRemoveReference={removeReference}
            onSend={handleSendFromInput}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder="Ask a question..."
          />
          <button
            onClick={handleSendClick}
            className="send-button"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
