import { useRef } from 'react';
import { ArrowUp, Plus, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { ChatReference, HighlightItem } from '../../types/chat';
import { usePendingReferences, useCircuitStore } from '../../store/circuitStore';
import { ReferenceTag } from '../chat/ReferenceTag';
import { ChatInputField } from '../chat/ChatInputField';
import type { ChatInputFieldHandle } from '../chat/ChatInputField';
import { ClickableIssue, parseIssuesFromResponse, type IssueData } from '../chat/ClickableIssue';
import { renderMessageContent, hasComponentReferences } from '../../utils/messageParser';
import '../shared/ComponentItem.css';
import './RightPanel.css';

// Cache for parsed issues to avoid re-parsing on every render
const issueCache = new Map<string, { issues: IssueData[]; cleanedResponse: string }>();

function getCachedIssues(content: string) {
  if (issueCache.has(content)) {
    return issueCache.get(content)!;
  }
  try {
    const result = parseIssuesFromResponse(content);
    // Limit cache size to prevent memory issues
    if (issueCache.size > 100) {
      const firstKey = issueCache.keys().next().value;
      if (firstKey) issueCache.delete(firstKey);
    }
    issueCache.set(content, result);
    return result;
  } catch (e) {
    console.error('Error parsing issues:', e);
    return { issues: [], cleanedResponse: content };
  }
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  references?: ChatReference[];
}

interface RightPanelProps {
  chatMessages: ChatMessage[];
  onSendMessage: (message: string, references?: ChatReference[]) => void;
  isLoading?: boolean;
}

export function RightPanel({
  chatMessages,
  onSendMessage,
  isLoading = false,
}: RightPanelProps) {
  const chatInputRef = useRef<ChatInputFieldHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get pending references and circuit state from store
  const pendingReferences = usePendingReferences();
  const placedComponents = useCircuitStore((state) => state.placedComponents);
  const {
    confirmReferences,
    removeReference,
    clearReferences,
    setInputFocused,
    setHighlights,
    clearHighlights,
  } = useCircuitStore();

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

  // Handle clicking on an existing component reference in AI message
  const handleExistingComponentClick = (instanceId: string) => {
    const highlights: HighlightItem[] = [{
      type: 'component',
      id: instanceId,
      severity: 'info',
    }];
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

  const handleAddFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    // UI-only: open native file picker; file handling/upload is out of scope for now
    // Keep a lightweight trace for later integration if needed.
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      console.log('[chat] selected files:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    }
    // Allow selecting the same file again
    e.target.value = '';
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

  // Render assistant message content with markdown support
  const renderAssistantContent = (content: string) => {
    // Safeguard: limit content length to prevent performance issues
    const safeContent = content.length > 10000 ? content.slice(0, 10000) + '...' : content;

    try {
      // Check if content has component references - use special rendering
      if (hasComponentReferences(safeContent)) {
        return renderMessageContent(safeContent, {
          circuitState: { placedComponents },
          onExistingComponentClick: handleExistingComponentClick,
        });
      }

      // Use ReactMarkdown for proper markdown rendering
      return (
        <div className="message-markdown">
          <ReactMarkdown>{safeContent}</ReactMarkdown>
        </div>
      );
    } catch (e) {
      console.error('Error rendering assistant content:', e);
      return <span className="message-text">{safeContent}</span>;
    }
  };

  return (
    <div className="right-panel-container">
      {/* Chat Messages */}
      <div className="chat-messages">
        {chatMessages.length === 0 ? (
          <div className="chat-empty-state">
            <p>Ask me anything about your circuit!</p>
            <p className="chat-hint">Click on components to reference them in your question.</p>
          </div>
        ) : (
          <>
          {chatMessages.map((msg, index) => {
            // Generate a stable key based on role and index
            const messageKey = `${msg.role}-${index}`;

            // For assistant messages, try to parse issues first
            if (msg.role === 'assistant') {
              const { issues } = getCachedIssues(msg.content);

              if (issues.length > 0) {
                // Extract content before first issue marker using simple string find
                const firstBracket = msg.content.indexOf('[1]');
                const contentBeforeIssues = firstBracket > 0 ? msg.content.slice(0, firstBracket).trim() : '';

                return (
                  <div key={messageKey} className="chat-message assistant">
                    <div className="message-bubble">
                      {/* Show the message content */}
                      {contentBeforeIssues && (
                        <div className="message-content">
                          {renderAssistantContent(contentBeforeIssues)}
                        </div>
                      )}
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

              // No issues - render with component references
              return (
                <div key={messageKey} className="chat-message assistant">
                  <div className="message-bubble">
                    <div className="message-content">
                      {renderAssistantContent(msg.content)}
                    </div>
                  </div>
                </div>
              );
            }

            // For user messages with references, show tags inline with text
            if (msg.role === 'user' && msg.references && msg.references.length > 0) {
              return (
                <div key={messageKey} className="chat-message user">
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
              <div key={messageKey} className={`chat-message ${msg.role}`}>
                <div className="message-bubble">{msg.content}</div>
              </div>
            );
          })}
          {/* Thinking indicator */}
          {isLoading && (
            <div className="chat-message assistant thinking">
              <div className="message-bubble thinking-bubble">
                <Loader2 size={16} className="thinking-spinner" />
                <span className="thinking-text">Thinking...</span>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* Fixed Chat Input */}
      <div className="chat-input-container">
        <div className="chat-input-composer">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="chat-file-input"
            onChange={handleFilesSelected}
            aria-hidden="true"
            tabIndex={-1}
          />
          <ChatInputField
            ref={chatInputRef}
            pendingReferences={pendingReferences}
            onRemoveReference={removeReference}
            onSend={handleSendFromInput}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder="Ask for changes..."
          />
          <button
            onClick={handleAddFileClick}
            className="attach-button"
            title="Add file"
            aria-label="Add file"
            type="button"
          >
            <Plus size={20} />
          </button>
          <button
            onClick={handleSendClick}
            className="send-button"
            type="button"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
