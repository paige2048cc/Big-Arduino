import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, Loader2 } from 'lucide-react';
import { Sidebar } from '../components/layout/Sidebar';
import { ScanResults } from '../components/scanner/ScanResults';
import { BlueCharacter } from '../components/ai/BlueCharacter';
import type { DetectedComponent } from '../utils/componentMatcher';
import { sendMessage, parseAIResponse, isAIServiceConfigured, type CircuitState } from '../services/aiService';
import './ScanChatPage.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  scanData?: {
    screenshot: string;
    detected: DetectedComponent[];
  };
}

export function ScanChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as {
    screenshot?: string;
    detected?: DetectedComponent[];
  } | null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state?.screenshot || !state?.detected) return;

    const initial: ChatMessage[] = [
      {
        id: 'scan-result',
        role: 'assistant',
        scanData: {
          screenshot: state.screenshot,
          detected: state.detected,
        },
      },
      {
        id: 'scan-greeting',
        role: 'assistant',
        content: `I found ${state.detected.length} component${state.detected.length === 1 ? '' : 's'}: **${state.detected.map(d => d.className).join(', ')}**. Check out the recommended projects above, or tell me what you'd like to build!`,
      },
    ];
    setMessages(initial);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
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
      const response = await sendMessage(text, [], circuitState);
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

  const handleProjectClick = (projectId: string) => {
    navigate(`/project/${projectId}`);
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
            <h1>Component Scanner</h1>
          </div>

          <div className="scan-chat-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`scan-chat-msg scan-chat-msg--${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="scan-chat-avatar scan-chat-avatar--character">
                    <BlueCharacter
                      x={16}
                      y={16}
                      visible={true}
                      mood={isLoading ? 'thinking' : 'happy'}
                      size="small"
                    />
                  </div>
                )}
                <div className="scan-chat-bubble">
                  {msg.scanData && (
                    <ScanResults
                      screenshot={msg.scanData.screenshot}
                      detected={msg.scanData.detected}
                      onProjectClick={handleProjectClick}
                    />
                  )}
                  {msg.content && <p className="scan-chat-text">{msg.content}</p>}
                </div>
              </div>
            ))}
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
