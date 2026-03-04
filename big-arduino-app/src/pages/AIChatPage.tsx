import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, Loader2, ChevronRight, BookOpen, Compass, Cpu, Package } from 'lucide-react';
import { Sidebar } from '../components/layout/Sidebar';
import { BlueCharacter } from '../components/ai/BlueCharacter';
import type { DetectedComponent, ProjectMatch } from '../utils/componentMatcher';
import { matchProjects, getChipClass } from '../utils/componentMatcher';
import { sendMessage, parseAIResponse, isAIServiceConfigured, type CircuitState, type ConversationMessage } from '../services/aiService';
import { parseMarkdown } from '../utils/markdownParser';
import './AIChatPage.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  scanData?: {
    screenshot: string;
    detected: DetectedComponent[];
  };
  componentTags?: DetectedComponent[];
  choiceQuestion?: {
    question: string;
    options: { id: string; label: string; description: string; icon: 'learning' | 'exploring' }[];
  };
  projectCards?: {
    matches: ProjectMatch[];
    bestMatchIntro: string;
  };
}

export function AIChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as {
    screenshot?: string;
    detected?: DetectedComponent[];
    initialMessage?: string;
  } | null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [choiceMade, setChoiceMade] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Convert chat messages to conversation history for AI
  const buildConversationHistory = (msgs: ChatMessage[]): ConversationMessage[] => {
    return msgs
      .filter(msg => msg.content) // Only include messages with text content
      .map(msg => ({
        role: msg.role,
        content: msg.content!,
      }));
  };

  // Determine page title based on entry type
  const getPageTitle = () => {
    if (state?.detected && state.detected.length > 0) {
      return 'Component Scanner';
    }
    if (state?.initialMessage) {
      // Truncate the initial message for the title
      const maxLength = 40;
      const msg = state.initialMessage;
      return msg.length > maxLength ? msg.substring(0, maxLength) + '...' : msg;
    }
    return 'AI Assistant';
  };

  // Handle initial message from homepage
  useEffect(() => {
    if (state?.initialMessage) {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: state.initialMessage,
      };
      setMessages([userMsg]);

      // Auto-send to AI
      const sendInitialMessage = async () => {
        if (!isAIServiceConfigured()) {
          setMessages(prev => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: "I'm still learning! For now, try clicking on one of the recommended projects above to get started with a guided tutorial.",
            },
          ]);
          return;
        }

        setIsLoading(true);
        const circuitState: CircuitState = {
          placedComponents: [],
          wires: [],
          isSimulating: false,
        };

        try {
          const response = await sendMessage(state.initialMessage!, [], circuitState);
          const parsed = parseAIResponse(response.content);
          setMessages(prev => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: parsed.content,
            },
          ]);
        } catch (error) {
          console.error('AI service error:', error);
          setMessages(prev => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: "Sorry, I had trouble processing that. For now, try clicking on one of the recommended projects above!",
            },
          ]);
        } finally {
          setIsLoading(false);
        }
      };

      sendInitialMessage();
      return;
    }

    // Handle scan results
    if (!state?.detected || state.detected.length === 0) return;

    const initial: ChatMessage[] = [
      {
        id: 'scan-tags',
        role: 'assistant',
        componentTags: state.detected,
      },
      {
        id: 'scan-choice',
        role: 'assistant',
        content: `I found ${state.detected.length} component${state.detected.length === 1 ? '' : 's'}! What would you like to do with them?`,
        choiceQuestion: {
          question: 'Choose your goal:',
          options: [
            {
              id: 'learning',
              label: 'Learning',
              description: 'Follow a guided project tutorial',
              icon: 'learning',
            },
            {
              id: 'exploring',
              label: 'Exploring',
              description: 'Chat with AI to discover ideas',
              icon: 'exploring',
            },
          ],
        },
      },
    ];
    setMessages(initial);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');

    // Build conversation history BEFORE adding new message
    const history = buildConversationHistory(messages);

    setMessages(prev => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: text },
    ]);

    // Check if AI service is configured
    if (!isAIServiceConfigured()) {
      setMessages(prev => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: "I'm still learning! For now, try clicking on one of the recommended projects above to get started with a guided tutorial.",
        },
      ]);
      return;
    }

    setIsLoading(true);

    // Build context from detected components
    const circuitState: CircuitState = {
      placedComponents: state?.detected?.map((d, i) => ({
        instanceId: `detected-${i}`,
        definitionId: d.className, // Use className as the component type
        x: 0,
        y: 0,
      })) || [],
      wires: [],
      isSimulating: false,
    };

    try {
      // Pass conversation history so AI knows about previous exchanges
      const response = await sendMessage(text, [], circuitState, undefined, history);
      const parsed = parseAIResponse(response.content);

      setMessages(prev => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: parsed.content,
        },
      ]);
    } catch (error) {
      console.error('AI service error:', error);
      setMessages(prev => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: "Sorry, I had trouble processing that. For now, try clicking on one of the recommended projects above!",
        },
      ]);
    } finally {
      setIsLoading(false);
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

  // Strip [[add:xxx]] / [[ref:xxx]] markers from AI message text (no canvas in chat page)
  const stripComponentRefs = (content: string): string =>
    content.replace(/\[\[(add|ref):[^\]]+\]\]\s*/g, '');

  // Detect if an assistant message contains project-start / wiring instructions
  const isConnectionMessage = (content: string): boolean => {
    const lower = content.toLowerCase();

    // Strong single-phrase triggers → immediately show button
    const strongTriggers = [
      // Chinese
      '开始搭建', '开始构建', '开始组装', '开始接线', '开始连接',
      '让我们开始', '我们开始搭', '首先需要放置', '首先放置',
      '开始这个项目', '开始项目',
      // English
      'start building', "let's start", "let's build", 'begin building',
      'begin wiring', "let's get started", 'start with the',
    ];
    if (strongTriggers.some(kw => lower.includes(kw.toLowerCase()))) return true;

    // Multi-keyword detection: need ≥ 2 wiring-related terms
    const keywords = [
      // English
      'connect', 'wire', 'gnd', '5v', 'resistor', 'pin', 'breadboard',
      'step 1', 'step 2', 'step1', 'step2',
      // Chinese
      '连接', '接线', '面包板', '电阻', '引脚', '步骤',
      '放置组件', '插入', '第一步', '第二步',
    ];
    return keywords.filter(kw => lower.includes(kw) || content.includes(kw)).length >= 2;
  };

  // Find the last qualifying assistant message ID for the Start Project button
  const getStartProjectMsgId = (): string | null => {
    if (messages.length < 2) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && msg.content && isConnectionMessage(msg.content)) {
        return msg.id;
      }
    }
    return null;
  };
  const startProjectMsgId = getStartProjectMsgId();

  const handleStartProject = () => {
    const chatHistory = messages
      .filter(m => m.content)
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content!,
      }));

    navigate('/project/ai-session', {
      state: {
        fromAIChat: true,
        initialChatMessages: chatHistory,
        projectTitle: getPageTitle(),
      },
    });
  };

  const handleProjectClick = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  const handleGoalChoice = async (choiceId: string) => {
    if (choiceMade) return;
    setChoiceMade(true);

    const choiceLabel = choiceId === 'learning' ? 'Learning' : 'Exploring';
    const userChoiceMsg: ChatMessage = {
      id: `user-choice-${Date.now()}`,
      role: 'user',
      content: `I'd like to start **${choiceLabel}**!`,
    };
    setMessages(prev => [...prev, userChoiceMsg]);

    if (choiceId === 'learning') {
      const detected = state?.detected || [];
      const matches = matchProjects(detected, 0).slice(0, 3);
      const bestMatch = matches[0];

      const bestMatchIntro = bestMatch
        ? `**${bestMatch.project.title}** is your best match at ${bestMatch.matchPercent}%! ${bestMatch.project.description}`
        : 'Check out these projects to get started!';

      const projectMsg: ChatMessage = {
        id: `projects-${Date.now()}`,
        role: 'assistant',
        content: `Great choice! Here are some featured projects that match your components:`,
        projectCards: { matches, bestMatchIntro },
      };
      setMessages(prev => [...prev, projectMsg]);
    } else {
      // Exploring: start AI chat guided flow
      const detected = state?.detected || [];
      const componentNames = detected.map(d => d.className).join(', ');

      const greetingId = `exploring-greeting-${Date.now()}`;
      const exploringGreeting: ChatMessage = {
        id: greetingId,
        role: 'assistant',
        content: `Awesome! Let's explore what you can create with **${componentNames}**. Tell me — is there a feeling, theme, or idea you'd like to express through a project? For example, something calming, playful, or interactive?`,
      };
      setMessages(prev => [...prev, exploringGreeting]);

      if (isAIServiceConfigured()) {
        setIsLoading(true);
        const circuitState: CircuitState = {
          placedComponents: detected.map((d, i) => ({
            instanceId: `detected-${i}`,
            definitionId: d.className,
            x: 0,
            y: 0,
          })),
          wires: [],
          isSimulating: false,
        };

        try {
          const exploringPrompt = `The user has these components: ${componentNames}. They chose "Exploring" mode — they want to brainstorm and discover creative project ideas. Start by asking them about what feelings, themes or ideas they'd like to explore. Be conversational and encouraging. Keep it brief.`;
          const response = await sendMessage(exploringPrompt, [], circuitState);
          const parsed = parseAIResponse(response.content);
          setMessages(prev => [
            ...prev.filter(m => m.id !== greetingId),
            {
              id: `assistant-explore-${Date.now()}`,
              role: 'assistant',
              content: parsed.content,
            },
          ]);
        } catch {
          // Keep the static greeting if AI fails
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  return (
    <div className="home-page">
      <div className="home-shell">
        <Sidebar />

        <main className="scan-chat-main">
          <div className="scan-chat-header">
            <div className="scan-chat-header-icon">
              <BlueCharacter
                x={18}
                y={18}
                visible={true}
                mood="happy"
                size="small"
              />
            </div>
            <h1>{getPageTitle()}</h1>
          </div>

          <div className="scan-chat-messages">
            {messages.map(msg => (
              <div key={msg.id}>
                <div className={`scan-chat-msg scan-chat-msg--${msg.role}`}>
                  {msg.role === 'assistant' && (
                    <div className="scan-chat-avatar scan-chat-avatar--character">
                      <BlueCharacter
                        x={16}
                        y={16}
                        visible={true}
                        mood="happy"
                        size="small"
                      />
                    </div>
                  )}
                  <div className="scan-chat-bubble">
                    {/* Component tags (no screenshot) */}
                    {msg.componentTags && (
                      <div className="scan-tags-only">
                        <div className="scan-results-section-title">
                          <Package size={16} />
                          Components Found ({msg.componentTags.length})
                        </div>
                        <div className="scan-results-tags">
                          {msg.componentTags.map(d => (
                            <span key={d.className} className={`scanner-tag ${getChipClass(d.className)}`}>
                              {d.className}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Text content */}
                    {msg.content && (
                      <div className="scan-chat-text">
                        {parseMarkdown(
                          msg.role === 'assistant' ? stripComponentRefs(msg.content) : msg.content
                        )}
                      </div>
                    )}

                    {/* Choice question */}
                    {msg.choiceQuestion && !choiceMade && (
                      <div className="goal-choice-container">
                        {msg.choiceQuestion.options.map(opt => (
                          <button
                            key={opt.id}
                            className={`goal-choice-btn goal-choice-btn--${opt.icon}`}
                            onClick={() => handleGoalChoice(opt.id)}
                            type="button"
                          >
                            <div className="goal-choice-icon">
                              {opt.icon === 'learning' ? <BookOpen size={24} /> : <Compass size={24} />}
                            </div>
                            <div className="goal-choice-label">{opt.label}</div>
                            <div className="goal-choice-desc">{opt.description}</div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Featured project cards */}
                    {msg.projectCards && (
                      <div className="featured-projects-section">
                        <div className="featured-projects-grid">
                          {msg.projectCards.matches.map(m => {
                            const isComingSoon = m.project.steps.length === 0;
                            const isBestMatch = m === msg.projectCards!.matches[0];
                            return (
                              <button
                                key={m.project.id}
                                className={`featured-project-card ${isComingSoon ? 'coming-soon' : ''} ${isBestMatch ? 'best-match' : ''}`}
                                onClick={() => !isComingSoon && handleProjectClick(m.project.id)}
                                disabled={isComingSoon}
                                type="button"
                              >
                                {isBestMatch && <div className="best-match-badge">Best Match</div>}
                                <div className={`featured-project-icon ${getDifficultyColor(m.project.difficulty)}`}>
                                  <Cpu size={20} />
                                </div>
                                <h4 className="featured-project-title">{m.project.title}</h4>
                                <p className="featured-project-desc">{m.project.description}</p>
                                <div className="featured-project-match">
                                  <div className="match-bar">
                                    <div className="match-bar-fill" style={{ width: `${m.matchPercent}%` }} />
                                  </div>
                                  <span className="match-percent">{m.matchPercent}% match</span>
                                </div>
                                {!isComingSoon && (
                                  <div className="featured-project-action">
                                    <span>Start</span>
                                    <ChevronRight size={14} />
                                  </div>
                                )}
                                {isComingSoon && <span className="featured-project-soon">Coming Soon</span>}
                              </button>
                            );
                          })}
                        </div>
                        <div className="featured-projects-intro">
                          {parseMarkdown(msg.projectCards.bestMatchIntro)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {msg.id === startProjectMsgId && (
                  <div className="start-project-action">
                    <button className="start-project-btn" onClick={handleStartProject}>
                      <span>Start Project</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {/* Thinking indicator */}
            {isLoading && (
              <div className="scan-chat-msg scan-chat-msg--assistant scan-chat-msg--thinking">
                <div className="scan-chat-avatar scan-chat-avatar--character">
                  <BlueCharacter
                    x={16}
                    y={16}
                    visible={true}
                    mood="thinking"
                    size="small"
                  />
                </div>
                <div className="scan-chat-bubble scan-chat-thinking-bubble">
                  <Loader2 size={16} className="scan-chat-thinking-spinner" />
                  <span className="scan-chat-thinking-text">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="scan-chat-input-area">
            <div className="scan-chat-input-wrapper">
              <input
                type="text"
                className="scan-chat-input"
                placeholder="Ask about your components or describe a project idea..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
              <button
                className="scan-chat-send"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                type="button"
                aria-label="Send message"
              >
                {isLoading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
