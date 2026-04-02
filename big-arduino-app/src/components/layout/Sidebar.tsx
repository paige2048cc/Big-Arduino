import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Zap, Home, Folder, BookOpen, Users, Menu, Settings } from 'lucide-react';

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const toggle = () => setIsCollapsed(prev => !prev);

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className={`home-sidebar ${isCollapsed ? 'collapsed' : ''}`} aria-label="Primary navigation">
      <div className="sidebar-header">
        <button
          className="sidebar-brand-toggle"
          type="button"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Brand'}
          tabIndex={isCollapsed ? 0 : -1}
          onClick={() => isCollapsed && toggle()}
        >
          <span className="sidebar-brand-iconSwap" aria-hidden="true">
            <Zap size={22} className="sidebar-brand-icon sidebar-brand-icon--zap" />
            <Menu size={20} className="sidebar-brand-icon sidebar-brand-icon--menu" />
          </span>
          <span className="sidebar-brand-text">Big Arduino</span>
        </button>

        <button
          className="sidebar-menu-button"
          type="button"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggle}
        >
          <Menu size={20} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`sidebar-nav-item ${isActive('/') ? 'active' : ''}`}
          type="button"
          data-label="Home"
          aria-label="Home"
          onClick={() => navigate('/')}
        >
          <Home size={18} />
          <span>Home</span>
        </button>
        <button className="sidebar-nav-item" type="button" data-label="Projects" aria-label="Projects">
          <Folder size={18} />
          <span>Projects</span>
        </button>
        <button className="sidebar-nav-item" type="button" data-label="Learn" aria-label="Learn">
          <BookOpen size={18} />
          <span>Learn</span>
        </button>
        <button className="sidebar-nav-item" type="button" data-label="Community" aria-label="Community">
          <Users size={18} />
          <span>Community</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar" aria-hidden="true">JD</div>
          <div className="sidebar-user-meta">
            <div className="sidebar-user-name">John Doe</div>
            <div className="sidebar-user-plan">Free Plan</div>
          </div>
        </div>
        <button className="sidebar-settings-button" type="button" aria-label="Settings">
          <Settings size={18} />
        </button>
      </div>
    </aside>
  );
}
