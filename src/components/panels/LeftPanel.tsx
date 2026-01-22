import { useState } from 'react';
import { Cpu, Code } from 'lucide-react';
import { ComponentLibrary } from './ComponentLibrary';
import './LeftPanel.css';

type TabType = 'components' | 'code';

interface LeftPanelProps {
  code?: string;
  onCodeChange?: (code: string) => void;
}

export function LeftPanel({ code = '', onCodeChange }: LeftPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('components');

  return (
    <div className="left-panel-container">
      {/* Tab Switcher */}
      <div className="panel-tabs">
        <button
          className={`panel-tab ${activeTab === 'components' ? 'active' : ''}`}
          onClick={() => setActiveTab('components')}
        >
          <Cpu size={16} />
          <span>Components</span>
        </button>
        <button
          className={`panel-tab ${activeTab === 'code' ? 'active' : ''}`}
          onClick={() => setActiveTab('code')}
        >
          <Code size={16} />
          <span>Code</span>
        </button>
      </div>

      {/* Panel Content */}
      <div className="panel-content">
        {activeTab === 'components' ? (
          <ComponentLibrary />
        ) : (
          <div className="code-editor-container">
            <div className="code-editor-header">
              <span>Arduino Code</span>
            </div>
            <textarea
              className="code-editor"
              value={code}
              onChange={(e) => onCodeChange?.(e.target.value)}
              placeholder="// Arduino code will appear here..."
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
