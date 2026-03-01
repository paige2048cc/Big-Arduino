import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Usb, Unplug, Play, Square } from 'lucide-react';
import { presetProjects } from '../data/projects';
import { useSerial } from '../hooks/useSerial';
import { ThreePanelLayout } from '../components/layout';
import { LeftPanel, RightPanel, ComponentPropertiesPanel, DockContainer } from '../components/panels';
import { CircuitCanvas } from '../components/canvas';
import { useCircuitStore, useWires, useSimulationErrors } from '../store/circuitStore';
import { DockingProvider, type PanelConfig } from '../contexts/DockingContext';
import type { ChatReference } from '../types/chat';
import { sendMessage, isAIServiceConfigured, getFallbackResponse, parseAIResponse, type CircuitState, type ProjectContext } from '../services/aiService';
// Character positioning is available for future debugging hints feature
// import { calculateCharacterPosition } from '../services/characterPositioning';
import { OnboardingOverlay } from '../components/onboarding';
import { useOnboardingStore } from '../store/onboardingStore';

// Default panel configurations for the docking system
const DEFAULT_PANELS: PanelConfig[] = [
  { id: 'instructions', title: 'Instructions', minHeight: 120, defaultHeight: 280 },
  { id: 'ai-assistant', title: 'AI Assistant', minHeight: 200, defaultHeight: 400 },
];

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Find the project
  const project = presetProjects.find(p => p.id === projectId);

  // State
  const [currentStep] = useState(0);
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string, references?: ChatReference[]}>>([
    { role: 'assistant', content: 'Hi! I\'m here to help you with this project. Ask me anything!' }
  ]);

  // Serial connection
  const { isConnected, isSupported, connect, disconnect } = useSerial();

  // Circuit store
  const {
    selectedComponentId,
    selectComponent,
    isSimulating,
    toggleSimulation,
    placedComponents,
    setHighlights,
    // Character functions available for future debugging hints
    // showAICharacter,
    // hideAICharacter,
    // updateAICharacterPosition,
    // componentDefinitions,
  } = useCircuitStore();
  const wires = useWires();
  const simulationErrors = useSimulationErrors();

  // AI loading state
  const [isAILoading, setIsAILoading] = useState(false);

  // Onboarding
  const initOnboarding = useOnboardingStore((state) => state.initOnboarding);
  const updateToolbarRect = useOnboardingStore((state) => state.updateToolbarRect);
  const updateTargetRect = useOnboardingStore((state) => state.updateTargetRect);

  // Initialize onboarding on mount
  useEffect(() => {
    initOnboarding();
  }, [initOnboarding]);

  // Track all target rects for onboarding overlay positioning
  useEffect(() => {
    const updateAllRects = () => {
      // Left toolbar (Step 1)
      const leftPanel = document.querySelector('.left-panel--floating');
      if (leftPanel) {
        updateToolbarRect(leftPanel.getBoundingClientRect());
      }

      // Instructions panel (Step 2)
      const instructionsPanel = document.querySelector('[data-panel-id="instructions"]');
      if (instructionsPanel) {
        updateTargetRect('[data-panel-id="instructions"]', instructionsPanel.getBoundingClientRect());
      }

      // AI Chat panel (Step 3)
      const aiPanel = document.querySelector('[data-panel-id="ai-assistant"]');
      if (aiPanel) {
        updateTargetRect('[data-panel-id="ai-assistant"]', aiPanel.getBoundingClientRect());
      }

      // Bottom toolbar (Step 4)
      const canvasToolbar = document.querySelector('.canvas-toolbar');
      if (canvasToolbar) {
        updateTargetRect('.canvas-toolbar', canvasToolbar.getBoundingClientRect());
      }
    };

    // Initial update (with delay to ensure DOM is ready)
    const initialTimeout = setTimeout(updateAllRects, 100);

    // Update on resize
    window.addEventListener('resize', updateAllRects);

    // Use ResizeObserver for panel resize changes
    const observers: ResizeObserver[] = [];
    const selectors = [
      '.left-panel--floating',
      '[data-panel-id="instructions"]',
      '[data-panel-id="ai-assistant"]',
      '.canvas-toolbar',
    ];

    selectors.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        const observer = new ResizeObserver(updateAllRects);
        observer.observe(element);
        observers.push(observer);
      }
    });

    // Use MutationObserver to detect when panels are added/removed
    const mutationObserver = new MutationObserver(() => {
      // Re-check for elements after DOM changes
      setTimeout(updateAllRects, 50);
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(initialTimeout);
      window.removeEventListener('resize', updateAllRects);
      observers.forEach(obs => obs.disconnect());
      mutationObserver.disconnect();
    };
  }, [updateToolbarRect, updateTargetRect]);

  const step = project?.steps[currentStep];

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

    // Build breadboard pin info for connectivity analysis
    const breadboardPins: Record<string, Array<{pinId: string, net: string}>> = {};
    const componentDefinitions = useCircuitStore.getState().componentDefinitions;
    for (const comp of placedComponents) {
      if (comp.definitionId.includes('breadboard')) {
        // Note: componentDefinitions uses instanceId as key, not definitionId
        const def = componentDefinitions.get(comp.instanceId);
        if (def) {
          breadboardPins[comp.instanceId] = def.pins
            .filter(p => p.net)
            .map(p => ({ pinId: p.id, net: p.net! }));
        }
      }
    }

    // Build circuit state for AI
    const circuitState: CircuitState = {
      placedComponents: placedComponents.map(c => {
        // Get internal connections from component definition
        const def = componentDefinitions.get(c.instanceId);
        return {
          instanceId: c.instanceId,
          definitionId: c.definitionId,
          x: c.x,
          y: c.y,
          rotation: c.rotation,
          parentBreadboardId: c.parentBreadboardId,
          insertedPins: c.insertedPins,
          internalConnections: def?.internalConnections,
        };
      }),
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
        severity: 'error' as const
      })),
      breadboardPins,
    };

    setIsAILoading(true);

    // Build project context so AI knows what project and step we're on
    const projectContext: ProjectContext | undefined = project ? {
      title: project.title,
      description: project.description,
      goal: project.goal,
      learningObjectives: project.learningObjectives,
      currentStepIndex: currentStep,
      totalSteps: project.steps.length,
      currentStepTitle: step?.title,
      currentStepInstructions: step?.instructions,
    } : undefined;

    try {
      const response = await sendMessage(message, references || [], circuitState, projectContext);

      // Parse the AI response to extract mood, target component, and cleaned content
      const parsed = parseAIResponse(response.content);

      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: parsed.content
      }]);

      // Apply highlights if any (character will only appear for explicit debugging hints, not regular chat)
      if (parsed.highlights && parsed.highlights.length > 0) {
        setHighlights(parsed.highlights);
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
  }, [placedComponents, wires, isSimulating, simulationErrors, setHighlights, project, currentStep, step]);

  // If project not found
  if (!project) {
    return (
      <div className="project-not-found">
        <h2>Project not found</h2>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  const handleComponentDrop = (componentId: string, x: number, y: number) => {
    console.log(`Dropped component ${componentId} at (${x}, ${y})`);
  };

  const handleComponentSelect = (instanceId: string | null) => {
    selectComponent(instanceId);
  };

  const handleCloseProperties = () => {
    selectComponent(null);
  };

  // Get current step code for left panel
  const currentCode = step?.code || '';

  // Render function for AI Chat panel content
  const renderAIChat = useCallback(() => (
    <RightPanel
      chatMessages={chatMessages}
      onSendMessage={handleChatSubmit}
      isLoading={isAILoading}
    />
  ), [chatMessages, handleChatSubmit, isAILoading]);

  return (
    <DockingProvider
      defaultPanels={DEFAULT_PANELS}
      initialPanelOrder={['instructions', 'ai-assistant']}
    >
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
              <span>{isSimulating ? 'Stop Simulation' : 'Start Simulation'}</span>
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
            initialLeftWidth={320}
            initialRightWidth={320}
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
              <DockContainer renderAIChat={renderAIChat} />
            }
          />
        </main>

        {/* Onboarding overlay */}
        <OnboardingOverlay />
      </div>
    </DockingProvider>
  );
}
