import React, { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { LedButtonControl } from './components/LedButtonControl';

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'project'>('landing');

  return (
    <div className="min-h-screen bg-slate-50">
      {currentView === 'landing' ? (
        <LandingPage onEnterProject={() => setCurrentView('project')} />
      ) : (
        <LedButtonControl onBack={() => setCurrentView('landing')} />
      )}
    </div>
  );
}
