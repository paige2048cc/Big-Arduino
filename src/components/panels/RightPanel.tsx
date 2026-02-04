import { useRef } from 'react';
import { MessageSquare, Send } from 'lucide-react';
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
  chatMessages: ChatMessage[];
  onSendMessage: (message: string, references?: ChatReference[]) => void;
}

export function RightPanel({
  chatMessages,
  onSendMessage,
}: RightPanelProps) {
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

  return (
    <div className="right-panel-container">
      {/* Chat Header */}
      <div className="chat-header">
        <MessageSquare size={18} />
        <span>AI Assistant</span>
      </div>

      {/* Chat Messages */}
      <div className="chat-messages">
        {chatMessages.length === 0 ? (
          <div className="chat-empty-state">
            <p>Ask me anything about your circuit!</p>
            <p className="chat-hint">Click on components to reference them in your question.</p>
          </div>
        ) : (
          chatMessages.map((msg, index) => {
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
          })
        )}
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
