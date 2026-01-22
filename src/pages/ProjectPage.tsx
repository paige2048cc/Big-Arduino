import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Usb, Unplug, Play, Square } from 'lucide-react';
import { presetProjects } from '../data/projects';
import { useSerial } from '../hooks/useSerial';
import { ThreePanelLayout } from '../components/layout';
import { LeftPanel, RightPanel, ComponentPropertiesPanel } from '../components/panels';
import { CircuitCanvas } from '../components/canvas';
import { useCircuitStore } from '../store/circuitStore';

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Find the project
  const project = presetProjects.find(p => p.id === projectId);

  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0])); // First step expanded by default
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([
    { role: 'assistant', content: 'Hi! I\'m here to help you with this project. Ask me anything!' }
  ]);

  // Serial connection
  const { isConnected, isSupported, connect, disconnect } = useSerial();

  // Circuit store
  const { selectedComponentId, selectComponent, isSimulating, toggleSimulation } = useCircuitStore();

  // If project not found
  if (!project) {
    return (
      <div className="project-not-found">
        <h2>Project not found</h2>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  const step = project.steps[currentStep];

  const handleChatSubmit = (message: string) => {
    // Add user message
    setChatMessages(prev => [...prev, { role: 'user', content: message }]);

    // Simulate AI response (in real app, this would call AI API)
    setTimeout(() => {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `That's a great question about "${message}"! For this step, make sure you follow the instructions carefully. If you're stuck, try checking your wiring connections first.`
      }]);
    }, 1000);
  };

  const handleComponentDrop = (componentId: string, x: number, y: number) => {
    console.log(`Dropped component ${componentId} at (${x}, ${y})`);
  };

  const handleComponentSelect = (instanceId: string | null) => {
    selectComponent(instanceId);
  };

  const handleCloseProperties = () => {
    selectComponent(null);
  };

  const handleStepChange = (step: number) => {
    setCurrentStep(step);
  };

  const handleToggleExpand = (stepIndex: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepIndex)) {
        next.delete(stepIndex);
      } else {
        next.add(stepIndex);
      }
      return next;
    });
  };

  const handleStepComplete = (completedIndex: number) => {
    // Mark step as completed
    setCompletedSteps(prev => new Set([...prev, completedIndex]));

    // Collapse completed step and expand next
    setExpandedSteps(prev => {
      const next = new Set(prev);
      next.delete(completedIndex);
      if (completedIndex < project.steps.length - 1) {
        next.add(completedIndex + 1);
      }
      return next;
    });

    // Move to next step if available
    if (completedIndex < project.steps.length - 1) {
      setCurrentStep(completedIndex + 1);
    }
  };

  // Get current step code for left panel
  const currentCode = step?.code || '';

  return (
    <div className="project-page">
      {/* Top Bar */}
      <header className="project-header">
        <button className="back-button" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>
        <h1>{project.title}</h1>
        <div className="header-actions">
          {/* Simulate Button */}
          <button
            className={`simulate-button ${isSimulating ? 'simulating' : ''}`}
            onClick={toggleSimulation}
          >
            {isSimulating ? <Square size={18} /> : <Play size={18} />}
            <span>{isSimulating ? 'Stop' : 'Simulate'}</span>
          </button>
          {/* Connection Status */}
          <div className="connection-status">
            {isConnected ? (
              <button className="connected" onClick={disconnect}>
                <Usb size={18} />
                <span>Connected</span>
              </button>
            ) : (
              <button className="disconnected" onClick={connect}>
                <Unplug size={18} />
                <span>{isSupported ? 'Connect Arduino' : 'Use Chrome/Edge'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Three Panel Layout */}
      <main className="project-main">
        <ThreePanelLayout
          leftPanel={
            <LeftPanel
              code={currentCode}
              onCodeChange={(code) => console.log('Code changed:', code)}
            />
          }
          centerPanel={
            <div style={{ position: 'relative', height: '100%' }}>
              <CircuitCanvas
                onComponentDrop={handleComponentDrop}
                onComponentSelect={handleComponentSelect}
              />
              {selectedComponentId && (
                <ComponentPropertiesPanel
                  onClose={handleCloseProperties}
                />
              )}
            </div>
          }
          rightPanel={
            <RightPanel
              steps={project.steps}
              currentStep={currentStep}
              completedSteps={completedSteps}
              expandedSteps={expandedSteps}
              onStepChange={handleStepChange}
              onToggleExpand={handleToggleExpand}
              onStepComplete={handleStepComplete}
              chatMessages={chatMessages}
              onSendMessage={handleChatSubmit}
            />
          }
        />
      </main>
    </div>
  );
}
