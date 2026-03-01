/**
 * AI Service
 *
 * Handles AI API integration via Vercel serverless function.
 * Provides circuit analysis and troubleshooting capabilities.
 */

import type { ChatReference, WireReference, HighlightItem, HighlightSeverity } from '../types/chat';
import { loadKnowledge } from './knowledgeService';
import {
  getSystemPrompt,
  buildContextPrompt,
  formatWireContext,
  formatKnowledgeContext
} from '../config/aiPrompts';

// Internal connections within a component
export interface InternalConnectionInfo {
  always?: string[][];  // Pins always connected internally
  whenPressed?: string[][]; // Connected when button pressed
  whenPowered?: string[][]; // Connected when powered
  notes?: string;
}

// Types for circuit state
export interface PlacedComponent {
  instanceId: string;
  definitionId: string;
  x: number;
  y: number;
  rotation?: number;
  // Breadboard insertion info
  parentBreadboardId?: string;
  insertedPins?: Record<string, string>; // componentPinId -> breadboardPinId
  // Internal connections for circuit analysis
  internalConnections?: InternalConnectionInfo;
}

// Breadboard pin information for connectivity analysis
export interface BreadboardPinInfo {
  pinId: string;
  net: string; // e.g., "row-10-top", "power-positive", "power-negative"
}

export interface Wire {
  id: string;
  startComponentId: string;
  startPinId: string;
  endComponentId: string;
  endPinId: string;
  color: string;
}

export interface CircuitState {
  placedComponents: PlacedComponent[];
  wires: Wire[];
  isSimulating: boolean;
  simulationErrors?: Array<{
    componentId?: string;
    wireId?: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  // Breadboard pin definitions for connectivity analysis
  breadboardPins?: Record<string, BreadboardPinInfo[]>; // breadboardInstanceId -> pins with nets
}

export interface ProjectContext {
  title: string;
  description?: string;
  /** What the completed circuit should do */
  goal?: string;
  /** Key learning objectives */
  learningObjectives?: string[];
  currentStepIndex: number;
  totalSteps: number;
  currentStepTitle?: string;
  currentStepInstructions?: string[];
}

export interface AIResponse {
  content: string;
  highlights?: HighlightItem[];
}

export type CharacterMood = 'thinking' | 'happy' | 'concerned' | 'celebrating';

export interface ParsedAIResponse {
  content: string;
  highlights: HighlightItem[];
  mood: CharacterMood;
  targetComponentId: string | null;
}

// API endpoint - works for both local dev and production
const API_ENDPOINT = '/api/chat';

// Debug function - call from browser console: window.debugCircuitState()
if (typeof window !== 'undefined') {
  (window as unknown as { debugCircuitState?: () => void }).debugCircuitState = () => {
    console.log('Call this after placing components and opening AI chat to see what data is being sent');
  };
}

/**
 * Analyze breadboard connectivity - find which component pins share the same breadboard row/net
 */
function analyzeBreadboardConnectivity(circuitState: CircuitState): Map<string, Array<{componentId: string, componentType: string, pinId: string}>> {
  const netGroups = new Map<string, Array<{componentId: string, componentType: string, pinId: string}>>();

  if (!circuitState.breadboardPins) {
    return netGroups;
  }

  for (const component of circuitState.placedComponents) {
    if (!component.parentBreadboardId || !component.insertedPins) {
      continue;
    }

    const breadboardPins = circuitState.breadboardPins[component.parentBreadboardId] || [];

    for (const [componentPinId, breadboardPinId] of Object.entries(component.insertedPins)) {
      // Find the net for this breadboard pin
      const pinInfo = breadboardPins.find(p => p.pinId === breadboardPinId);
      if (pinInfo && pinInfo.net) {
        if (!netGroups.has(pinInfo.net)) {
          netGroups.set(pinInfo.net, []);
        }
        netGroups.get(pinInfo.net)!.push({
          componentId: component.instanceId,
          componentType: component.definitionId,
          pinId: componentPinId
        });
      }
    }
  }

  return netGroups;
}

/**
 * Build component context from ALL placed components (not just referenced ones)
 */
function buildAllComponentsContext(circuitState: CircuitState): string {
  if (circuitState.placedComponents.length === 0) {
    return 'No components placed on the canvas yet.';
  }

  const contextParts: string[] = [];
  contextParts.push(`**${circuitState.placedComponents.length} Components on Canvas:**`);

  // Analyze breadboard connectivity
  const breadboardNets = analyzeBreadboardConnectivity(circuitState);

  for (const component of circuitState.placedComponents) {
    // Skip breadboard itself in component listing
    if (component.definitionId.includes('breadboard')) {
      continue;
    }

    // Get wire connections for this component
    const wireConnections = circuitState.wires
      .filter(w => w.startComponentId === component.instanceId || w.endComponentId === component.instanceId)
      .map(w => {
        if (w.startComponentId === component.instanceId) {
          return `    - ${w.startPinId} → ${w.endComponentId}.${w.endPinId} (wire)`;
        } else {
          return `    - ${w.endPinId} ← ${w.startComponentId}.${w.startPinId} (wire)`;
        }
      });

    // Get breadboard connections (pins connected via same breadboard row)
    const breadboardConnections: string[] = [];
    if (component.insertedPins) {
      for (const [pinId] of Object.entries(component.insertedPins)) {
        // Find which net this pin is on and what else is connected
        for (const [net, components] of breadboardNets.entries()) {
          const myEntry = components.find(c => c.componentId === component.instanceId && c.pinId === pinId);
          if (myEntry) {
            const others = components.filter(c => c.componentId !== component.instanceId);
            for (const other of others) {
              breadboardConnections.push(`    - ${pinId} ↔ ${other.componentType}.${other.pinId} (via breadboard ${net})`);
            }
          }
        }
      }
    }

    // Breadboard insertion info
    let insertionInfo = '';
    if (component.parentBreadboardId && component.insertedPins) {
      const pins = Object.entries(component.insertedPins)
        .map(([compPin, bbPin]) => `${compPin}→${bbPin}`)
        .join(', ');
      insertionInfo = `\n  Inserted in breadboard: ${pins}`;
    }

    // Internal connections info
    let internalInfo = '';
    if (component.internalConnections) {
      const ic = component.internalConnections;
      const parts: string[] = [];
      if (ic.always && ic.always.length > 0) {
        const alwaysStr = ic.always.map(group => group.join('↔')).join(', ');
        parts.push(`Always connected: ${alwaysStr}`);
      }
      if (ic.whenPressed && ic.whenPressed.length > 0) {
        const pressedStr = ic.whenPressed.map(group => group.join('↔')).join(', ');
        parts.push(`Connected when pressed: ${pressedStr}`);
      }
      if (parts.length > 0) {
        internalInfo = `\n  Internal wiring: ${parts.join('; ')}`;
      }
    }

    const allConnections = [...wireConnections, ...breadboardConnections];
    const connectionStr = allConnections.length > 0
      ? `\n  Connections:\n${allConnections.join('\n')}`
      : '\n  Connections: None';

    contextParts.push(`- **${component.definitionId}** (ID: ${component.instanceId})${internalInfo}${insertionInfo}${connectionStr}`);
  }

  // Add summary of breadboard connectivity
  if (breadboardNets.size > 0) {
    contextParts.push('\n**Breadboard Connectivity Summary:**');
    contextParts.push('(Components on the same breadboard row are electrically connected)');
    for (const [net, components] of breadboardNets.entries()) {
      if (components.length > 1) {
        const desc = components.map(c => `${c.componentType}.${c.pinId}`).join(' ↔ ');
        contextParts.push(`- ${net}: ${desc}`);
      }
    }
  }

  return contextParts.join('\n');
}

/**
 * Build component context from explicit references (for @-mentioned components)
 */
async function buildReferencedComponentContext(
  references: ChatReference[],
  circuitState: CircuitState
): Promise<string> {
  const contextParts: string[] = [];

  for (const ref of references) {
    if (ref.type === 'single') {
      const component = circuitState.placedComponents.find(
        c => c.instanceId === ref.instanceId
      );
      if (component) {
        // Load knowledge for this component
        const knowledge = await loadKnowledge(ref.definitionId);
        if (knowledge) {
          contextParts.push(formatKnowledgeContext(
            knowledge.frontmatter.name,
            knowledge.content.substring(0, 500), // Truncate for context
            knowledge.frontmatter.common_issues || [],
            knowledge.frontmatter.safety || []
          ));
        }
      }
    }
  }

  return contextParts.join('\n\n');
}

/**
 * Build project context string
 */
function buildProjectContext(projectContext?: ProjectContext): string {
  if (!projectContext) {
    return '';
  }

  const parts: string[] = [];
  parts.push(`## Current Project: ${projectContext.title}`);

  if (projectContext.description) {
    parts.push(`Description: ${projectContext.description}`);
  }

  // Include explicit goal so AI knows what the circuit should do
  if (projectContext.goal) {
    parts.push(`\n**Project Goal:** ${projectContext.goal}`);
  }

  // Include learning objectives
  if (projectContext.learningObjectives && projectContext.learningObjectives.length > 0) {
    parts.push('\n**Learning Objectives:**');
    projectContext.learningObjectives.forEach(obj => {
      parts.push(`- ${obj}`);
    });
  }

  parts.push(`\nProgress: Step ${projectContext.currentStepIndex + 1} of ${projectContext.totalSteps}`);

  if (projectContext.currentStepTitle) {
    parts.push(`Current Step: **${projectContext.currentStepTitle}**`);
  }

  if (projectContext.currentStepInstructions && projectContext.currentStepInstructions.length > 0) {
    const instructionsText = projectContext.currentStepInstructions.map((instr, i) => `${i + 1}. ${instr}`).join('\n');
    parts.push(`\nStep Instructions:\n${instructionsText}`);
  }

  return parts.join('\n');
}

/**
 * Build wire context from circuit state
 */
function buildWireContext(
  references: ChatReference[],
  circuitState: CircuitState
): string {
  const wireRefs = references.filter((r): r is WireReference => r.type === 'wire');
  const contextParts: string[] = [];

  // Add referenced wires
  for (const wireRef of wireRefs) {
    const wire = circuitState.wires.find(w => w.id === wireRef.wireId);
    if (wire) {
      contextParts.push(formatWireContext(
        wire.id,
        wire.startComponentId,
        wire.startPinId,
        wire.endComponentId,
        wire.endPinId,
        wire.color
      ));
    }
  }

  // Add all wires if asking about general circuit
  if (wireRefs.length === 0 && circuitState.wires.length > 0) {
    contextParts.push('**All Circuit Wires:**');
    for (const wire of circuitState.wires.slice(0, 10)) { // Limit to 10 wires
      contextParts.push(`- ${wire.startComponentId}.${wire.startPinId} -> ${wire.endComponentId}.${wire.endPinId}`);
    }
    if (circuitState.wires.length > 10) {
      contextParts.push(`- ... and ${circuitState.wires.length - 10} more wires`);
    }
  }

  return contextParts.join('\n');
}

/**
 * Build simulation status context
 */
function buildSimulationStatus(circuitState: CircuitState): string {
  if (!circuitState.isSimulating) {
    return 'Simulation is not currently running.';
  }

  if (!circuitState.simulationErrors || circuitState.simulationErrors.length === 0) {
    return 'Simulation is running with no errors detected.';
  }

  const errors = circuitState.simulationErrors
    .map(e => `- [${e.severity.toUpperCase()}] ${e.message}`)
    .join('\n');

  return `Simulation is running with the following issues:\n${errors}`;
}

/**
 * Parse AI response for highlight instructions
 */
function parseHighlights(response: string): HighlightItem[] {
  const highlights: HighlightItem[] = [];

  // Look for patterns like [LED_1], [WIRE_2], etc.
  const componentPattern = /\[([A-Za-z]+_\d+)\]/g;
  const matches = response.matchAll(componentPattern);

  for (const match of matches) {
    const id = match[1];
    const isWire = id.toLowerCase().startsWith('wire');

    // Determine severity from context
    let severity: HighlightSeverity = 'info';
    const beforeMatch = response.substring(Math.max(0, match.index! - 50), match.index!);
    if (beforeMatch.includes('[ERROR]') || beforeMatch.includes('error') || beforeMatch.includes('wrong')) {
      severity = 'error';
    } else if (beforeMatch.includes('[WARNING]') || beforeMatch.includes('warning') || beforeMatch.includes('might')) {
      severity = 'warning';
    } else if (beforeMatch.includes('suggest') || beforeMatch.includes('try')) {
      severity = 'suggestion';
    }

    highlights.push({
      type: isWire ? 'wire' : 'component',
      id,
      severity,
    });
  }

  return highlights;
}

/**
 * Parse the full AI response to extract mood, target component, and clean content
 */
export function parseAIResponse(rawResponse: string): ParsedAIResponse {
  // Extract mood from [MOOD:xxx] tag
  const moodMatch = rawResponse.match(/\[MOOD:(\w+)\]/i);
  let mood: CharacterMood = 'happy';
  if (moodMatch) {
    const moodValue = moodMatch[1].toLowerCase();
    if (['thinking', 'happy', 'concerned', 'celebrating'].includes(moodValue)) {
      mood = moodValue as CharacterMood;
    }
  }

  // Remove mood tag from content
  let content = rawResponse.replace(/\[MOOD:\w+\]/gi, '').trim();

  // Extract component references [[ref:xxx]] to find target component
  const refMatches = [...content.matchAll(/\[\[ref:([^\]]+)\]\]/g)];
  const targetComponentId = refMatches.length > 0 ? refMatches[0][1] : null;

  // Parse highlights using existing function
  const highlights = parseHighlights(content);

  // Also add highlights for [[ref:xxx]] patterns
  for (const match of refMatches) {
    const instanceId = match[1];
    // Check if already in highlights
    if (!highlights.some(h => h.id === instanceId)) {
      highlights.push({
        type: 'component',
        id: instanceId,
        severity: 'info',
      });
    }
  }

  return {
    content,
    highlights,
    mood,
    targetComponentId,
  };
}

/**
 * Send a message to the AI assistant via Vercel serverless function
 */
export async function sendMessage(
  content: string,
  references: ChatReference[],
  circuitState: CircuitState,
  projectContext?: ProjectContext
): Promise<AIResponse> {
  // Debug: Log circuit state summary (keep this for debugging)
  console.log('[AI Debug] Components:', circuitState.placedComponents.map(c => ({
    type: c.definitionId,
    hasParent: !!c.parentBreadboardId,
    insertedPins: c.insertedPins,
    internalConnections: c.internalConnections,
  })));
  console.log('[AI Debug] Breadboard pins available:', circuitState.breadboardPins ? Object.keys(circuitState.breadboardPins) : 'none');

  // Build context from ALL placed components (so AI can see the full circuit)
  const allComponentsContext = buildAllComponentsContext(circuitState);

  // Build additional context for explicitly referenced components (knowledge)
  const referencedContext = await buildReferencedComponentContext(references, circuitState);

  // Combine component contexts
  const componentContext = referencedContext
    ? `${allComponentsContext}\n\n### Referenced Component Knowledge:\n${referencedContext}`
    : allComponentsContext;

  const wireContext = buildWireContext(references, circuitState);
  const simulationStatus = buildSimulationStatus(circuitState);

  // Build project context if available
  const projectContextStr = buildProjectContext(projectContext);

  // Combine all context
  let fullContext = buildContextPrompt(
    componentContext,
    wireContext,
    simulationStatus,
    content
  );

  // Prepend project context if available
  if (projectContextStr) {
    fullContext = `${projectContextStr}\n\n${fullContext}`;
  }

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: content,
        systemPrompt: getSystemPrompt(),
        context: fullContext,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || `API request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    const highlights = parseHighlights(data.content);

    return {
      content: data.content,
      highlights
    };
  } catch (error) {
    console.error('Error calling AI API:', error);
    throw error;
  }
}

/**
 * Check if AI service is configured
 * Always returns true since API key is handled server-side
 */
export function isAIServiceConfigured(): boolean {
  return true;
}

/**
 * Get a fallback response when AI request fails
 */
export function getFallbackResponse(message: string, references: ChatReference[]): string {
  if (references.length > 0) {
    const refNames = references.map(r => r.displayName).join(', ');
    return `I see you're asking about ${refNames}. ${message ? `Regarding "${message}": ` : ''}I'm having trouble connecting to the AI service. Please try again in a moment.`;
  }
  return `I'm having trouble processing your question about "${message}". Please try again in a moment.`;
}
