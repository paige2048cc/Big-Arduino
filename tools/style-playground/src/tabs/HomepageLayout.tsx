import { useState } from 'react'
import './HomepageLayout.css'
import {
  Zap, Send, Clock, ChevronRight, ArrowRight,
  Lightbulb, Cpu, BookOpen, Star, Layers,
  CircuitBoard, Play, Sparkles, Search, Mail,
  Code, MessageSquare, Paperclip, User
} from 'lucide-react'

// Mock project data (mirrors Big Arduino preset projects)
const mockProjects = [
  {
    id: 'led-button',
    title: 'LED Button Control',
    description: 'Learn the basics by controlling an LED with a button press.',
    difficulty: 'beginner',
    time: '15-20 min',
    available: true,
  },
  {
    id: 'traffic-light',
    title: 'Traffic Light System',
    description: 'Build a realistic traffic light with timed sequences.',
    difficulty: 'intermediate',
    time: '30-40 min',
    available: false,
  },
  {
    id: 'plant-monitor',
    title: 'Smart Plant Monitor',
    description: 'Monitor soil moisture and get alerts when your plant needs water.',
    difficulty: 'advanced',
    time: '45-60 min',
    available: false,
  },
]

// ════════════════════════════════════════════════════════════════════════════
// STYLE A — Bento Grid (Light, Agency-style, varied card sizes)
// Inspired by: QClay Agency layout with asymmetric grid and stats row
// ════════════════════════════════════════════════════════════════════════════
function StyleA() {
  const [idea, setIdea] = useState('')

  return (
    <div className="style-a">
      {/* Navigation */}
      <nav className="a-nav">
        <div className="a-logo">
          <Zap size={24} />
          <span>Big Arduino</span>
        </div>
        <div className="a-nav-links">
          <a href="#" className="a-nav-link active">Home</a>
          <a href="#" className="a-nav-link">Projects</a>
          <a href="#" className="a-nav-link">Learn</a>
          <a href="#" className="a-nav-link">Community</a>
        </div>
        <button className="a-cta-btn">Get Started</button>
      </nav>

      {/* Bento Grid */}
      <div className="a-bento">
        {/* Hero Card (large) */}
        <div className="a-card a-hero">
          <div className="a-hero-content">
            <h1>Big Arduino —<br/>Circuit Creator</h1>
            <p className="a-hero-sub">It's about creating<br/>something amazing</p>
          </div>
          <div className="a-hero-visual">
            <div className="a-circuit-graphic">
              <CircuitBoard size={120} strokeWidth={1} />
            </div>
          </div>
          <button className="a-arrow-btn">
            <ArrowRight size={20} />
          </button>
        </div>

        {/* AI Input Card */}
        <div className="a-card a-input-card">
          <div className="a-input-icon">
            <Sparkles size={24} />
          </div>
          <h3>What will you create?</h3>
          <p>Describe your idea and AI will guide you step by step</p>
          <div className="a-input-wrap">
            <input
              type="text"
              placeholder="A plant watering reminder..."
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
            />
            <button className="a-send-btn"><Send size={16} /></button>
          </div>
        </div>

        {/* Feature Card */}
        <div className="a-card a-feature-card">
          <h2>We help makers<br/>learn & create</h2>
          <p>Step-by-step guidance<br/>for every project</p>
          <button className="a-arrow-btn small">
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Project Preview Cards */}
        {mockProjects.slice(0, 2).map((proj) => (
          <div key={proj.id} className={`a-card a-project-card ${!proj.available ? 'coming-soon' : ''}`}>
            <div className="a-project-img">
              <Cpu size={32} />
            </div>
            <div className="a-project-info">
              <span className={`a-difficulty ${proj.difficulty}`}>{proj.difficulty}</span>
              <h4>{proj.title}</h4>
              <p>{proj.description}</p>
            </div>
            {!proj.available && <div className="a-soon-badge">Soon</div>}
          </div>
        ))}
      </div>

      {/* Stats Row */}
      <div className="a-stats-row">
        <div className="a-stat-card">
          <span className="a-stat-label">projects</span>
          <span className="a-stat-arrow"><ArrowRight size={14} /></span>
          <div className="a-stat-content">
            <span className="a-stat-desc">Guided tutorials available</span>
            <span className="a-stat-value">+12</span>
          </div>
        </div>
        <div className="a-stat-card highlight">
          <span className="a-stat-label">learners</span>
          <span className="a-stat-arrow"><ArrowRight size={14} /></span>
          <div className="a-stat-content">
            <span className="a-stat-desc">Makers building with us</span>
            <span className="a-stat-value">+2.5k</span>
          </div>
        </div>
        <div className="a-stat-card tags">
          <div className="a-tag-cloud">
            <span className="a-tag">LED</span>
            <span className="a-tag">Sensors</span>
            <span className="a-tag">IoT</span>
            <span className="a-tag">Motors</span>
            <span className="a-tag">Arduino</span>
            <span className="a-tag">Breadboard</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// STYLE B — Playful Illustrated (Warm colors, large cards, friendly)
// Inspired by: Parent/Child app with bold colors and illustrations
// ════════════════════════════════════════════════════════════════════════════
function StyleB() {
  const [idea, setIdea] = useState('')

  return (
    <div className="style-b">
      {/* Header */}
      <header className="b-header">
        <div className="b-logo">
          <Zap size={28} />
          <span>Big Arduino</span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="b-hero">
        <h1>What will you<br/>build today?</h1>
        <p>Select a project to get started</p>
      </section>

      {/* Selection Cards */}
      <div className="b-selection">
        <div className="b-select-card teal">
          <span className="b-card-label">Beginner</span>
          <div className="b-card-illustration">
            <Lightbulb size={64} strokeWidth={1.5} />
          </div>
        </div>
        <div className="b-select-card coral">
          <span className="b-card-label">Intermediate</span>
          <div className="b-card-illustration">
            <Cpu size={64} strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* AI Input */}
      <section className="b-ai-section">
        <h2>Or describe your idea</h2>
        <p className="b-ai-subtitle">We'll help you build it step by step</p>
        <div className="b-input-area">
          <div className="b-input-illustration">
            <Sparkles size={48} />
          </div>
          <input
            type="text"
            placeholder="A device that waters my plants..."
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
        </div>
        <button className="b-continue-btn">
          Continue
        </button>
      </section>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// STYLE C — Clean Minimal Dashboard (Light gray, white cards, soft shadows)
// Inspired by: Health dashboard with data widgets
// ════════════════════════════════════════════════════════════════════════════
function StyleC() {
  const [idea, setIdea] = useState('')

  return (
    <div className="style-c">
      {/* Header */}
      <header className="c-header">
        <div className="c-logo">
          <Zap size={20} />
          <span>Big Arduino</span>
        </div>
        <nav className="c-nav">
          <a href="#" className="c-nav-item active">Dashboard</a>
          <a href="#" className="c-nav-item">Projects</a>
          <a href="#" className="c-nav-item">Learn</a>
        </nav>
      </header>

      {/* Dashboard Grid */}
      <div className="c-dashboard">
        {/* AI Input Widget */}
        <div className="c-widget c-ai-widget">
          <div className="c-widget-header">
            <Sparkles size={18} />
            <span>Create with AI</span>
          </div>
          <div className="c-input-row">
            <input
              type="text"
              placeholder="Describe your project idea..."
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
            />
            <button className="c-send"><Send size={16} /></button>
          </div>
        </div>

        {/* Stats Widgets */}
        <div className="c-widget c-stat-widget">
          <div className="c-widget-header">
            <BookOpen size={18} />
            <span>Projects</span>
            <span className="c-count">12</span>
          </div>
          <div className="c-mini-chart">
            <div className="c-bar" style={{ height: '40%' }}></div>
            <div className="c-bar" style={{ height: '60%' }}></div>
            <div className="c-bar" style={{ height: '80%' }}></div>
            <div className="c-bar" style={{ height: '55%' }}></div>
            <div className="c-bar active" style={{ height: '90%' }}></div>
          </div>
          <span className="c-value">3 <small>completed</small></span>
        </div>

        <div className="c-widget c-stat-widget">
          <div className="c-widget-header">
            <Clock size={18} />
            <span>Learning</span>
          </div>
          <div className="c-progress-ring">
            <svg viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#e8ebf0" strokeWidth="3"/>
              <circle cx="18" cy="18" r="15" fill="none" stroke="#4a7cff" strokeWidth="3"
                strokeDasharray="65, 100" strokeLinecap="round" transform="rotate(-90 18 18)"/>
            </svg>
            <span className="c-ring-value">65%</span>
          </div>
        </div>

        <div className="c-widget c-stat-widget wide">
          <div className="c-widget-header">
            <Layers size={18} />
            <span>Skill Progress</span>
          </div>
          <div className="c-skills">
            <div className="c-skill">
              <span>LEDs & Buttons</span>
              <div className="c-skill-bar"><div style={{ width: '85%' }}></div></div>
            </div>
            <div className="c-skill">
              <span>Sensors</span>
              <div className="c-skill-bar"><div style={{ width: '45%' }}></div></div>
            </div>
            <div className="c-skill">
              <span>Motors</span>
              <div className="c-skill-bar"><div style={{ width: '20%' }}></div></div>
            </div>
          </div>
        </div>

        {/* Project Cards */}
        <h3 className="c-section-title">Recommended Projects</h3>
        <div className="c-projects">
          {mockProjects.map((proj) => (
            <div key={proj.id} className={`c-project-card ${!proj.available ? 'disabled' : ''}`}>
              <div className="c-project-icon">
                <Cpu size={24} />
              </div>
              <div className="c-project-info">
                <h4>{proj.title}</h4>
                <span className="c-project-meta">
                  <Clock size={12} /> {proj.time}
                </span>
              </div>
              <ChevronRight size={18} className="c-chevron" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// STYLE D — Dark Gradient Modern (Dark theme, vibrant gradients, glass cards)
// Inspired by: Learning platform with progress tracking and gradient blobs
// ════════════════════════════════════════════════════════════════════════════
function StyleD() {
  const [idea, setIdea] = useState('')

  return (
    <div className="style-d">
      {/* Gradient Blobs (background decorations) */}
      <div className="d-blob d-blob-1"></div>
      <div className="d-blob d-blob-2"></div>
      <div className="d-blob d-blob-3"></div>

      {/* Header */}
      <header className="d-header">
        <div className="d-logo">
          <Zap size={22} />
          <span>Big Arduino</span>
        </div>
        <div className="d-user">
          <span>Welcome back</span>
          <div className="d-avatar">M</div>
        </div>
      </header>

      {/* Progress Banner */}
      <div className="d-progress-banner">
        <div className="d-progress-ring">
          <svg viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3"/>
            <circle cx="18" cy="18" r="15" fill="none" stroke="#fff" strokeWidth="3"
              strokeDasharray="42, 100" strokeLinecap="round" transform="rotate(-90 18 18)"/>
          </svg>
          <span>42%</span>
        </div>
        <div className="d-progress-text">
          <span className="d-progress-title">Your progress is great!</span>
          <span className="d-progress-sub">Keep up the good work</span>
        </div>
      </div>

      {/* Hero Text */}
      <section className="d-hero">
        <h1>Learn more &amp;<br/><em>improve your</em><br/>skills.</h1>
        <button className="d-hero-btn">
          <ArrowRight size={18} />
        </button>
      </section>

      {/* Featured Project Card */}
      <div className="d-featured-card">
        <div className="d-card-gradient"></div>
        <span className="d-card-tag">Beginner</span>
        <h3>LED Button Control</h3>
        <div className="d-card-meta">
          <span><BookOpen size={14} /> 5 Steps</span>
          <span><Clock size={14} /> 15 min</span>
        </div>
        <p>Learn the basics by controlling an LED with a button press. Perfect for getting started!</p>
        <button className="d-play-btn">
          <Play size={16} fill="currentColor" />
        </button>
        <div className="d-card-rating">
          <Star size={14} fill="#fbbf24" stroke="#fbbf24" />
          <span>4.9</span>
        </div>
      </div>

      {/* Category Filters */}
      <div className="d-filters">
        <span className="d-filter active">All</span>
        <span className="d-filter">Beginner</span>
        <span className="d-filter">Sensors</span>
        <span className="d-filter">Motors</span>
      </div>

      {/* Project Grid */}
      <div className="d-projects-grid">
        {mockProjects.map((proj, i) => (
          <div key={proj.id} className={`d-project-tile gradient-${i + 1}`}>
            <span className="d-tile-tag">{proj.difficulty}</span>
            <h4>{proj.title}</h4>
            <button className="d-tile-arrow">
              <ArrowRight size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* AI Input */}
      <div className="d-ai-input">
        <Sparkles size={18} />
        <input
          type="text"
          placeholder="Describe your project idea..."
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />
        <button><Send size={16} /></button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// STYLE E — Editorial Portfolio (Serif typography, card gallery)
// Inspired by: NiceAtNoon with large typography and horizontal project gallery
// ════════════════════════════════════════════════════════════════════════════
function StyleE() {
  return (
    <div className="style-e">
      {/* Navigation */}
      <nav className="e-nav">
        <div className="e-logo">
          <span className="e-logo-text">Big<em>Arduino</em></span>
        </div>
        <div className="e-logo-icon">
          <Zap size={20} />
        </div>
        <div className="e-nav-pills">
          <a href="#" className="e-pill">Projects</a>
          <a href="#" className="e-pill">Learn</a>
          <a href="#" className="e-pill filled">Contact</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="e-hero">
        <div className="e-hero-left">
          <h1>Building circuits<br/>and conquering<br/>projects <span className="e-hero-icon"><Zap size={36} /></span></h1>
        </div>
        <div className="e-hero-right">
          <p>Big Arduino is your companion for learning physical computing with AI-guided tutorials.</p>
          <button className="e-cta">
            View projects <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* Project Gallery */}
      <div className="e-gallery">
        {mockProjects.map((proj, i) => (
          <div key={proj.id} className={`e-gallery-card color-${i + 1}`}>
            <div className="e-card-inner">
              <Cpu size={28} />
              <span className="e-card-title">{proj.title}</span>
            </div>
          </div>
        ))}
        <div className="e-gallery-card color-4">
          <div className="e-card-inner">
            <Sparkles size={28} />
            <span className="e-card-title">Your Idea</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// STYLE F — Platform/Marketplace (Search hero, tabs, featured content)
// Inspired by: Dribbble with search-focused layout and category browsing
// ════════════════════════════════════════════════════════════════════════════
function StyleF() {
  const [idea, setIdea] = useState('')
  const [activeTab, setActiveTab] = useState('projects')

  const popularTags = ['LED', 'Sensors', 'Motors', 'IoT', 'Display', 'Sound']

  return (
    <div className="style-f">
      {/* Navigation */}
      <nav className="f-nav">
        <div className="f-logo">
          <Zap size={22} />
          <span>Big Arduino</span>
        </div>
        <div className="f-nav-links">
          <a href="#">Explore</a>
          <a href="#">Learn</a>
          <a href="#">Community</a>
        </div>
        <div className="f-nav-right">
          <button className="f-brief-btn">
            <Sparkles size={16} />
            Start a Project
          </button>
          <div className="f-avatar">
            <User size={18} />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="f-main">
        <div className="f-left">
          <h1>Discover<br/>Amazing Projects</h1>
          <p className="f-subtitle">Explore tutorials from the community and start building your own circuits today.</p>

          {/* Tabs */}
          <div className="f-tabs">
            <button
              className={`f-tab ${activeTab === 'projects' ? 'active' : ''}`}
              onClick={() => setActiveTab('projects')}
            >
              <CircuitBoard size={16} />
              Projects
            </button>
            <button
              className={`f-tab ${activeTab === 'tutorials' ? 'active' : ''}`}
              onClick={() => setActiveTab('tutorials')}
            >
              <BookOpen size={16} />
              Tutorials
            </button>
            <button
              className={`f-tab ${activeTab === 'components' ? 'active' : ''}`}
              onClick={() => setActiveTab('components')}
            >
              <Cpu size={16} />
              Components
            </button>
          </div>

          {/* Search */}
          <div className="f-search">
            <input
              type="text"
              placeholder="What do you want to build?"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
            />
            <button className="f-search-btn">
              <Search size={18} />
            </button>
          </div>

          {/* Popular Tags */}
          <div className="f-popular">
            <span className="f-popular-label">Popular:</span>
            {popularTags.map(tag => (
              <span key={tag} className="f-tag">{tag}</span>
            ))}
          </div>
        </div>

        {/* Featured Card */}
        <div className="f-featured">
          <div className="f-featured-card">
            <div className="f-featured-visual">
              <CircuitBoard size={64} strokeWidth={1} />
            </div>
            <div className="f-featured-author">
              <div className="f-author-avatar">A</div>
              <span>Arduino Team</span>
            </div>
          </div>
        </div>
      </div>

      {/* Brief Banner */}
      <div className="f-brief-banner">
        <div className="f-brief-left">
          <span className="f-brief-badge">NEW</span>
          <button className="f-brief-link">
            <Sparkles size={14} />
            Start with AI
          </button>
        </div>
        <p>Tell us what you want to build and get a personalized project guide instantly.</p>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// STYLE G — AI Chat Interface (Centered input, suggestion cards)
// Inspired by: ChatGPT-style with greeting, centered input, and prompt examples
// ════════════════════════════════════════════════════════════════════════════
function StyleG() {
  const [idea, setIdea] = useState('')

  const suggestions = [
    { icon: <Lightbulb size={18} />, title: 'LED project for a', subtitle: 'beginner' },
    { icon: <Mail size={18} />, title: 'Build a notification', subtitle: 'system with buzzer' },
    { icon: <MessageSquare size={18} />, title: 'Explain how', subtitle: 'sensors work' },
    { icon: <Code size={18} />, title: 'Help me debug', subtitle: 'my Arduino code' },
  ]

  return (
    <div className="style-g">
      {/* Sidebar */}
      <aside className="g-sidebar">
        <div className="g-sidebar-top">
          <div className="g-logo">
            <Zap size={20} />
          </div>
          <button className="g-sidebar-btn active"><CircuitBoard size={18} /></button>
          <button className="g-sidebar-btn"><BookOpen size={18} /></button>
          <button className="g-sidebar-btn"><Cpu size={18} /></button>
        </div>
        <div className="g-sidebar-bottom">
          <div className="g-user-avatar">M</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="g-main">
        {/* Header */}
        <header className="g-header">
          <div className="g-model-select">
            <Zap size={14} />
            <span>Big Arduino</span>
            <ChevronRight size={14} style={{ transform: 'rotate(90deg)' }} />
          </div>
          <div className="g-header-right">
            <button className="g-header-btn"><Search size={16} /> Search</button>
            <button className="g-header-btn">+ New Project</button>
          </div>
        </header>

        {/* Center Content */}
        <div className="g-center">
          {/* Orb */}
          <div className="g-orb"></div>

          {/* Greeting */}
          <h1 className="g-greeting">
            Good afternoon, Maker.<br/>
            <span className="g-accent">What will you build?</span>
          </h1>

          {/* Input Area */}
          <div className="g-input-area">
            <div className="g-input-box">
              <Sparkles size={18} className="g-input-icon" />
              <input
                type="text"
                placeholder="Describe your project idea..."
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
              />
            </div>
            <div className="g-input-actions">
              <button className="g-action-btn"><Paperclip size={16} /> Attach</button>
              <button className="g-action-btn">Difficulty <ChevronRight size={14} style={{ transform: 'rotate(90deg)' }} /></button>
              <button className="g-send-btn"><ArrowRight size={16} /></button>
            </div>
          </div>

          {/* Suggestions */}
          <div className="g-suggestions">
            <span className="g-suggestions-label">GET STARTED WITH AN EXAMPLE</span>
            <div className="g-suggestion-grid">
              {suggestions.map((s, i) => (
                <div key={i} className="g-suggestion-card">
                  <span className="g-suggestion-text">{s.title}<br/>{s.subtitle}</span>
                  <span className="g-suggestion-icon">{s.icon}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// STYLE H — Dark Lime Dashboard (Based on Image #7)
// Deep black background, lime green (#9EFF00) accent, glass cards, modern
// ════════════════════════════════════════════════════════════════════════════
function StyleH() {
  const [idea, setIdea] = useState('')

  return (
    <div className="style-h">
      {/* Navigation */}
      <nav className="h-nav">
        <div className="h-logo">
          <Zap size={20} />
          <span>Big Arduino</span>
        </div>
        <div className="h-nav-links">
          <a href="#" className="h-nav-link active">Home</a>
          <a href="#" className="h-nav-link">Projects</a>
          <a href="#" className="h-nav-link">Learn</a>
          <a href="#" className="h-nav-link">Community</a>
        </div>
        <div className="h-nav-right">
          <button className="h-nav-btn">
            <Search size={18} />
          </button>
          <button className="h-cta-btn">Get Started</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="h-hero">
        <div className="h-hero-badge">
          <Sparkles size={14} />
          <span>AI-Powered Learning</span>
        </div>
        <h1>Build Amazing<br/><span className="h-accent">Arduino Projects</span></h1>
        <p className="h-hero-sub">From blinking LEDs to IoT devices. Learn electronics with AI guidance.</p>

        {/* AI Input */}
        <div className="h-input-area">
          <div className="h-input-box">
            <Sparkles size={20} className="h-input-icon" />
            <input
              type="text"
              placeholder="Describe your project idea..."
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
            />
            <button className="h-send-btn">
              <Send size={18} />
            </button>
          </div>
          <div className="h-input-hints">
            <span>Try:</span>
            <button className="h-hint-chip">LED blink project</button>
            <button className="h-hint-chip">Temperature sensor</button>
            <button className="h-hint-chip">Smart plant monitor</button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="h-features">
        <div className="h-feature-card">
          <div className="h-feature-icon">
            <Lightbulb size={24} />
          </div>
          <h3>Guided Tutorials</h3>
          <p>Step-by-step instructions for every skill level</p>
        </div>
        <div className="h-feature-card">
          <div className="h-feature-icon">
            <CircuitBoard size={24} />
          </div>
          <h3>Virtual Canvas</h3>
          <p>Design circuits before building them</p>
        </div>
        <div className="h-feature-card">
          <div className="h-feature-icon">
            <MessageSquare size={24} />
          </div>
          <h3>AI Assistant</h3>
          <p>Get help anytime you're stuck</p>
        </div>
      </section>

      {/* Stats Row */}
      <section className="h-stats">
        <div className="h-stat">
          <span className="h-stat-value">12+</span>
          <span className="h-stat-label">Projects</span>
        </div>
        <div className="h-stat">
          <span className="h-stat-value">2.5k</span>
          <span className="h-stat-label">Makers</span>
        </div>
        <div className="h-stat">
          <span className="h-stat-value">50+</span>
          <span className="h-stat-label">Components</span>
        </div>
      </section>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Main Export — Shows all 8 styles
// ════════════════════════════════════════════════════════════════════════════
export default function HomepageLayout() {
  const [activeStyle, setActiveStyle] = useState<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'>('A')

  const styles = [
    { id: 'A' as const, name: 'Bento Grid', desc: 'Light, agency-style, asymmetric layout' },
    { id: 'B' as const, name: 'Playful', desc: 'Warm colors, illustrated, friendly' },
    { id: 'C' as const, name: 'Minimal Dashboard', desc: 'Clean, widgets, data-focused' },
    { id: 'D' as const, name: 'Dark Gradient', desc: 'Modern, vibrant gradients, glass' },
    { id: 'E' as const, name: 'Editorial', desc: 'Serif typography, portfolio gallery' },
    { id: 'F' as const, name: 'Platform', desc: 'Search-focused, marketplace style' },
    { id: 'G' as const, name: 'AI Chat', desc: 'Centered input, ChatGPT-inspired' },
    { id: 'H' as const, name: 'Dark Lime', desc: 'Deep black, #9EFF00 accent, modern' },
  ]

  return (
    <div className="homepage-exploration">
      {/* Style Selector */}
      <div className="style-selector">
        <h2>Homepage Style Explorations</h2>
        <p>Eight visual directions for the Big Arduino homepage</p>
        <div className="style-options">
          {styles.map((s) => (
            <button
              key={s.id}
              className={`style-option ${activeStyle === s.id ? 'active' : ''}`}
              onClick={() => setActiveStyle(s.id)}
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
      <div className={`preview-container ${activeStyle === 'H' ? 'dark' : ''}`}>
        <div className="preview-frame">
          {activeStyle === 'A' && <StyleA />}
          {activeStyle === 'B' && <StyleB />}
          {activeStyle === 'C' && <StyleC />}
          {activeStyle === 'D' && <StyleD />}
          {activeStyle === 'E' && <StyleE />}
          {activeStyle === 'F' && <StyleF />}
          {activeStyle === 'G' && <StyleG />}
          {activeStyle === 'H' && <StyleH />}
        </div>
      </div>
    </div>
  )
}
