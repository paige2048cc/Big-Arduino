import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Usb, Unplug, Play, Square } from 'lucide-react';
import { presetProjects } from '../data/projects';
import { useSerial } from '../hooks/useSerial';
import { ThreePanelLayout } from '../components/layout';
import { LeftPanel, RightPanel, ComponentPropertiesPanel } from '../components/panels';
import { CircuitCanvas } from '../components/canvas';
import { useCircuitStore, useWires, useSimulationErrors } from '../store/circuitStore';
import type { ChatReference } from '../types/chat';
import { sendMessage, isAIServiceConfigured, getFallbackResponse, type CircuitState } from '../services/aiService';

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Find the project
  const project = presetProjects.find(p => p.id === projectId);

  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0])); // First step expanded by default
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string, references?: ChatReference[]}>>([
    { role: 'assistant', content: 'Hi! I\'m here to help you with this project. Ask me anything!' }
  ]);

  // Serial connection
  const { isConnected, isSupported, connect, disconnect } = useSerial();

  // Circuit store
  const { selectedComponentId, selectComponent, isSimulating, toggleSimulation, placedComponents, setHighlights } = useCircuitStore();
  const wires = useWires();
  const simulationErrors = useSimulationErrors();

  // AI loading state
  // Loading state for AI responses (can be used to show loading indicator)
  const [_isAILoading, setIsAILoading] = useState(false);

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

  const handleChatSubmit = useCallback(async (message: string, references?: ChatReference[]) => {
    // Add user message with references stored separately
    setChatMessages(prev => [...prev, {
      role: 'user',
      content: message,
      references: references && references.length > 0 ? references : undefined
    }]);

    // Check if AI service is configured
    if (!isAIServiceConfigured()) {
      // Use fallback response
      setTimeout(() => {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: getFallbackResponse(message, references || [])
        }]);
      }, 500);
      return;
    }

    // Build circuit state for AI
    const circuitState: CircuitState = {
      placedComponents: placedComponents.map(c => ({
        instanceId: c.instanceId,
        definitionId: c.definitionId,
        x: c.x,
        y: c.y,
        rotation: c.rotation
      })),
      wires: wires.map(w => ({
        id: w.id,
        startComponentId: w.startComponentId,
        startPinId: w.startPinId,
        endComponentId: w.endComponentId,
        endPinId: w.endPinId,
        color: w.color
      })),
      isSimulating,
      simulationErrors: simulationErrors.map(e => ({
        componentId: e.componentId,
        wireId: e.wireId,
        message: e.message,
        // Derive severity from error type - most circuit errors are actual errors
        severity: 'error' as const
      }))
    };

    setIsAILoading(true);

    try {
      const response = await sendMessage(message, references || [], circuitState);

      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: response.content
      }]);

      // Apply highlights if any
      if (response.highlights && response.highlights.length > 0) {
        setHighlights(response.highlights);
      }
    } catch (error) {
      console.error('AI service error:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.'
      }]);
    } finally {
      setIsAILoading(false);
    }
  }, [placedComponents, wires, isSimulating, simulationErrors, setHighlights]);

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
