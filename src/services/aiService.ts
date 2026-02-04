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
  formatComponentContext,
  formatWireContext,
  formatKnowledgeContext
} from '../config/aiPrompts';

// Types for circuit state
export interface PlacedComponent {
  instanceId: string;
  definitionId: string;
  x: number;
  y: number;
  rotation?: number;
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
}

export interface AIResponse {
  content: string;
  highlights?: HighlightItem[];
}

// API endpoint - works for both local dev and production
const API_ENDPOINT = '/api/chat';

/**
 * Build component context from references
 */
async function buildComponentContext(
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
        // Get connections for this component
        const connections = circuitState.wires
          .filter(w => w.startComponentId === ref.instanceId || w.endComponentId === ref.instanceId)
          .map(w => {
            if (w.startComponentId === ref.instanceId) {
              return `  - ${w.startPinId} -> ${w.endComponentId}.${w.endPinId}`;
            } else {
              return `  - ${w.endPinId} <- ${w.startComponentId}.${w.startPinId}`;
            }
          })
          .join('\n');

        contextParts.push(formatComponentContext(
          ref.displayName,
          ref.instanceId,
          ref.definitionId,
          component.x,
          component.y,
          connections || '  - No connections'
        ));

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
    } else if (ref.type === 'multi') {
      for (const comp of ref.components) {
        const component = circuitState.placedComponents.find(
          c => c.instanceId === comp.instanceId
        );
        if (component) {
          const connections = circuitState.wires
            .filter(w => w.startComponentId === comp.instanceId || w.endComponentId === comp.instanceId)
            .map(w => {
              if (w.startComponentId === comp.instanceId) {
                return `  - ${w.startPinId} -> ${w.endComponentId}.${w.endPinId}`;
              } else {
                return `  - ${w.endPinId} <- ${w.startComponentId}.${w.startPinId}`;
              }
            })
            .join('\n');

          contextParts.push(formatComponentContext(
            comp.definitionId,
            comp.instanceId,
            comp.definitionId,
            component.x,
            component.y,
            connections || '  - No connections'
          ));
        }
      }
    }
  }

  return contextParts.join('\n\n');
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
 * Send a message to the AI assistant via Vercel serverless function
 */
export async function sendMessage(
  content: string,
  references: ChatReference[],
  circuitState: CircuitState
): Promise<AIResponse> {
  // Build context from references and circuit state
  const componentContext = await buildComponentContext(references, circuitState);
  const wireContext = buildWireContext(references, circuitState);
  const simulationStatus = buildSimulationStatus(circuitState);

  const contextPrompt = buildContextPrompt(
    componentContext,
    wireContext,
    simulationStatus,
    content
  );

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: content,
        systemPrompt: getSystemPrompt(),
        context: contextPrompt,
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
