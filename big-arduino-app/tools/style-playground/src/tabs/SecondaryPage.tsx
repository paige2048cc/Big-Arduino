import { useState } from 'react'
import './SecondaryPage.css'
import {
  Zap, Send, ChevronRight,
  Cpu, CircuitBoard, Sparkles, Search,
  MessageSquare, Paperclip, Play,
  Grid3X3, Maximize2, ZoomIn, ZoomOut, RotateCcw,
  Component, MoreHorizontal
} from 'lucide-react'

/**
 * SECONDARY PAGE STYLE EXPLORATION
 *
 * Style A: Dark Lime (based on image #7)
 * - Dark background (#0a0a0a, #111, #1a1a1a)
 * - Lime green accent (#9EFF00)
 * - Subtle borders (#222, #333)
 * - Three-panel workspace layout
 *
 * Style G: Light Purple (based on Homepage Style G UI)
 * - White/light background (#fff, #f8f8f8, #f5f5f5)
 * - Purple accent (#a78bfa, #6366f1)
 * - Light gray borders (#e8e8e8, #f0f0f0)
 * - Black primary buttons (#1a1a1a)
 */

// Mock component library data
const componentCategories = [
  {
    name: 'Microcontrollers',
    items: [
      { id: 'arduino-uno', name: 'Arduino Uno' },
      { id: 'arduino-nano', name: 'Arduino Nano' },
    ]
  },
  {
    name: 'Passive Components',
    items: [
      { id: 'led', name: 'LED (5mm)' },
      { id: 'resistor', name: 'Resistor' },
      { id: 'button', name: 'Push Button' },
    ]
  },
  {
    name: 'Sensors',
    items: [
      { id: 'temp-sensor', name: 'Temperature' },
      { id: 'light-sensor', name: 'Light Sensor' },
    ]
  },
]

// Mock chat messages
const mockMessages = [
  { role: 'assistant', content: 'Hello! I can help you build your Arduino project. What would you like to create?' },
  { role: 'user', content: 'I want to make an LED blink' },
  { role: 'assistant', content: 'Great choice for getting started! You\'ll need an Arduino Uno, an LED, and a 220Ω resistor. Let me guide you through the setup.' },
]

// ============================================================================
// Style A - Dark Lime Workspace (Image #7 Reference)
// Three-panel layout with dark theme and lime green accent
// ============================================================================
function StyleAWorkspace() {
  const [message, setMessage] = useState('')
  const [expandedCategory, setExpandedCategory] = useState('Passive Components')

  return (
    <div className="sp-workspace sp-dark">
      {/* Left Panel - Component Library */}
      <aside className="sp-left-panel">
        <div className="sp-panel-header">
          <Component size={18} />
          <span>Components</span>
          <button className="sp-panel-action">
            <Search size={16} />
          </button>
        </div>
        <div className="sp-component-list">
          {componentCategories.map((cat) => (
            <div key={cat.name} className="sp-category">
              <button
                className={`sp-category-header ${expandedCategory === cat.name ? 'expanded' : ''}`}
                onClick={() => setExpandedCategory(expandedCategory === cat.name ? '' : cat.name)}
              >
                <ChevronRight size={14} className="sp-chevron" />
                <span>{cat.name}</span>
                <span className="sp-count">{cat.items.length}</span>
              </button>
              {expandedCategory === cat.name && (
                <div className="sp-category-items">
                  {cat.items.map((item) => (
                    <div key={item.id} className="sp-component-item">
                      <div className="sp-component-icon">
                        <Cpu size={16} />
                      </div>
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Center - Canvas */}
      <main className="sp-canvas-area">
        <div className="sp-canvas-toolbar">
          <div className="sp-toolbar-left">
            <span className="sp-project-name">LED Blink Project</span>
            <span className="sp-project-status">Editing</span>
          </div>
          <div className="sp-toolbar-center">
            <button className="sp-tool-btn"><ZoomOut size={16} /></button>
            <span className="sp-zoom-level">100%</span>
            <button className="sp-tool-btn"><ZoomIn size={16} /></button>
            <div className="sp-tool-divider"></div>
            <button className="sp-tool-btn"><Grid3X3 size={16} /></button>
            <button className="sp-tool-btn"><RotateCcw size={16} /></button>
          </div>
          <div className="sp-toolbar-right">
            <button className="sp-tool-btn"><Maximize2 size={16} /></button>
            <button className="sp-run-btn">
              <Play size={14} />
              Run
            </button>
          </div>
        </div>

        <div className="sp-canvas">
          <div className="sp-canvas-grid"></div>
          <div className="sp-canvas-placeholder">
            <CircuitBoard size={48} />
            <p>Drag components here to start building</p>
          </div>
        </div>
      </main>

      {/* Right Panel - AI Chat */}
      <aside className="sp-right-panel">
        <div className="sp-panel-header">
          <MessageSquare size={18} />
          <span>AI Assistant</span>
          <button className="sp-panel-action">
            <MoreHorizontal size={16} />
          </button>
        </div>

        <div className="sp-chat-messages">
          {mockMessages.map((msg, i) => (
            <div key={i} className={`sp-message sp-message--${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="sp-message-avatar">
                  <Sparkles size={14} />
                </div>
              )}
              <div className="sp-message-content">{msg.content}</div>
            </div>
          ))}
        </div>

        <div className="sp-chat-input">
          <div className="sp-input-box">
            <input
              type="text"
              placeholder="Ask a question..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button className="sp-attach-btn">
              <Paperclip size={16} />
            </button>
          </div>
          <button className="sp-send-btn">
            <Send size={16} />
          </button>
        </div>
      </aside>
    </div>
  )
}

// ============================================================================
// Style G - Light Purple Workspace (Homepage Style G UI Reference)
// Three-panel layout with light theme and purple accent
// ============================================================================
function StyleGWorkspace() {
  const [message, setMessage] = useState('')
  const [expandedCategory, setExpandedCategory] = useState('Passive Components')

  return (
    <div className="sp-workspace">
      {/* Left Panel - Component Library */}
      <aside className="sp-left-panel">
        <div className="sp-panel-header">
          <Component size={18} />
          <span>Components</span>
          <button className="sp-panel-action">
            <Search size={16} />
          </button>
        </div>
        <div className="sp-component-list">
          {componentCategories.map((cat) => (
            <div key={cat.name} className="sp-category">
              <button
                className={`sp-category-header ${expandedCategory === cat.name ? 'expanded' : ''}`}
                onClick={() => setExpandedCategory(expandedCategory === cat.name ? '' : cat.name)}
              >
                <ChevronRight size={14} className="sp-chevron" />
                <span>{cat.name}</span>
                <span className="sp-count">{cat.items.length}</span>
              </button>
              {expandedCategory === cat.name && (
                <div className="sp-category-items">
                  {cat.items.map((item) => (
                    <div key={item.id} className="sp-component-item">
                      <div className="sp-component-icon">
                        <Cpu size={16} />
                      </div>
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Center - Canvas */}
      <main className="sp-canvas-area">
        {/* Canvas Toolbar */}
        <div className="sp-canvas-toolbar">
          <div className="sp-toolbar-left">
            <span className="sp-project-name">LED Blink Project</span>
            <span className="sp-project-status">Editing</span>
          </div>
          <div className="sp-toolbar-center">
            <button className="sp-tool-btn"><ZoomOut size={16} /></button>
            <span className="sp-zoom-level">100%</span>
            <button className="sp-tool-btn"><ZoomIn size={16} /></button>
            <div className="sp-tool-divider"></div>
            <button className="sp-tool-btn"><Grid3X3 size={16} /></button>
            <button className="sp-tool-btn"><RotateCcw size={16} /></button>
          </div>
          <div className="sp-toolbar-right">
            <button className="sp-tool-btn"><Maximize2 size={16} /></button>
            <button className="sp-run-btn">
              <Play size={14} />
              Run
            </button>
          </div>
        </div>

        {/* Canvas Content */}
        <div className="sp-canvas">
          <div className="sp-canvas-grid"></div>
          <div className="sp-canvas-placeholder">
            <CircuitBoard size={48} />
            <p>Drag components here to start building</p>
          </div>
        </div>
      </main>

      {/* Right Panel - AI Chat */}
      <aside className="sp-right-panel">
        <div className="sp-panel-header">
          <MessageSquare size={18} />
          <span>AI Assistant</span>
          <button className="sp-panel-action">
            <MoreHorizontal size={16} />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="sp-chat-messages">
          {mockMessages.map((msg, i) => (
            <div key={i} className={`sp-message sp-message--${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="sp-message-avatar">
                  <Sparkles size={14} />
                </div>
              )}
              <div className="sp-message-content">{msg.content}</div>
            </div>
          ))}
        </div>

        {/* Chat Input */}
        <div className="sp-chat-input">
          <div className="sp-input-box">
            <input
              type="text"
              placeholder="Ask a question..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button className="sp-attach-btn">
              <Paperclip size={16} />
            </button>
          </div>
          <button className="sp-send-btn">
            <Send size={16} />
          </button>
        </div>
      </aside>
    </div>
  )
}

// ============================================================================
// Main Export with Style Selector
// ============================================================================
type SecondaryStyle = 'A' | 'G'

const styles: { id: SecondaryStyle; name: string; desc: string; dark?: boolean }[] = [
  { id: 'A', name: 'Dark Lime', desc: 'Image #7 reference', dark: true },
  { id: 'G', name: 'Light Purple', desc: 'Style G UI reference' },
]

export default function SecondaryPage() {
  const [currentStyle, setCurrentStyle] = useState<SecondaryStyle>('A')
  const currentStyleInfo = styles.find(s => s.id === currentStyle)!

  return (
    <div className="secondary-exploration">
      {/* Style Selector */}
      <div className="style-selector">
        <h2>Secondary Page Style Exploration</h2>
        <p>Project workspace with different visual themes</p>
        <div className="style-options">
          {styles.map((s) => (
            <button
              key={s.id}
              className={`style-option ${currentStyle === s.id ? 'active' : ''}`}
              onClick={() => setCurrentStyle(s.id)}
            >
              <span className="style-letter">{s.id}</span>
              <div className="style-info">
                <strong>{s.name}</strong>
                <small>{s.desc}</small>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Preview Container */}
      <div className={`preview-container ${currentStyleInfo.dark ? 'dark' : ''}`}>
        <div className="preview-frame">
          {currentStyle === 'A' && <StyleAWorkspace />}
          {currentStyle === 'G' && <StyleGWorkspace />}
        </div>
      </div>
    </div>
  )
}
