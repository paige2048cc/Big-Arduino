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

// Conversation history message
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
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
 * This includes:
 * 1. Component pins inserted directly into breadboard rows
 * 2. Wire endpoints connected to breadboard rows (the wire brings the other end into the net)
 */
function analyzeBreadboardConnectivity(circuitState: CircuitState): Map<string, Array<{componentId: string, componentType: string, pinId: string}>> {
  const netGroups = new Map<string, Array<{componentId: string, componentType: string, pinId: string}>>();

  if (!circuitState.breadboardPins) {
    return netGroups;
  }

  // Find all breadboard instance IDs
  const breadboardInstanceIds = new Set<string>();
  for (const comp of circuitState.placedComponents) {
    if (comp.definitionId.includes('breadboard')) {
      breadboardInstanceIds.add(comp.instanceId);
    }
  }

  // 1. Add component pins inserted directly into breadboard
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

  // 2. Add wire endpoints connected to breadboard rows
  // When a wire connects to a breadboard row, the OTHER end of the wire is effectively in that net
  console.log('[Wire-BB Debug] === VERSION 2 === Checking wires. Count:', circuitState.wires.length);
  console.log('[Wire-BB Debug] Breadboard instance IDs:', Array.from(breadboardInstanceIds));

  for (const wire of circuitState.wires) {
    console.log('[Wire-BB Debug] Wire:', wire.startComponentId, '.', wire.startPinId, ' -> ', wire.endComponentId, '.', wire.endPinId);

    let breadboardEndId: string | null = null;
    let breadboardPinId: string | null = null;
    let otherComponentId: string | null = null;
    let otherPinId: string | null = null;

    // Check if start is a breadboard
    if (breadboardInstanceIds.has(wire.startComponentId)) {
      breadboardEndId = wire.startComponentId;
      breadboardPinId = wire.startPinId;
      otherComponentId = wire.endComponentId;
      otherPinId = wire.endPinId;
      console.log('[Wire-BB Debug] Wire START is breadboard');
    }
    // Check if end is a breadboard
    else if (breadboardInstanceIds.has(wire.endComponentId)) {
      breadboardEndId = wire.endComponentId;
      breadboardPinId = wire.endPinId;
      otherComponentId = wire.startComponentId;
      otherPinId = wire.startPinId;
      console.log('[Wire-BB Debug] Wire END is breadboard');
    } else {
      console.log('[Wire-BB Debug] Wire does NOT connect to breadboard');
    }

    if (breadboardEndId && breadboardPinId && otherComponentId && otherPinId) {
      // Handle breadboard-to-breadboard wires (jump wires connecting rows to power rails)
      if (breadboardInstanceIds.has(otherComponentId)) {
        console.log('[Wire-BB Debug] *** JUMP WIRE DETECTED *** (V2) - NOT skipping!');

        // Both ends are on a breadboard - this is a jump wire connecting two nets
        const startPins = circuitState.breadboardPins[wire.startComponentId] || [];
        const endPins = circuitState.breadboardPins[wire.endComponentId] || [];

        const startPinInfo = startPins.find(p => p.pinId === wire.startPinId);
        const endPinInfo = endPins.find(p => p.pinId === wire.endPinId);

        console.log('[Wire-BB Debug] Jump wire connects:', startPinInfo?.net, '↔', endPinInfo?.net);

        if (startPinInfo?.net && endPinInfo?.net && startPinInfo.net !== endPinInfo.net) {
          // Add to both nets so the connectivity shows up
          if (!netGroups.has(startPinInfo.net)) {
            netGroups.set(startPinInfo.net, []);
          }
          if (!netGroups.has(endPinInfo.net)) {
            netGroups.set(endPinInfo.net, []);
          }

          // Cross-reference: add entries from each net to the other
          const startNetComponents = netGroups.get(startPinInfo.net)!;
          const endNetComponents = netGroups.get(endPinInfo.net)!;

          // Copy components from endNet to startNet (marking them as connected via jump wire)
          for (const comp of endNetComponents) {
            if (!startNetComponents.some(c => c.componentId === comp.componentId && c.pinId === comp.pinId)) {
              startNetComponents.push({
                ...comp,
                pinId: `${comp.pinId} (via ${endPinInfo.net})`
              });
            }
          }

          // Copy components from startNet to endNet
          for (const comp of startNetComponents) {
            if (!comp.pinId.includes('via') && !endNetComponents.some(c => c.componentId === comp.componentId && c.pinId === comp.pinId)) {
              endNetComponents.push({
                ...comp,
                pinId: `${comp.pinId} (via ${startPinInfo.net})`
              });
            }
          }
        }
        continue;
      }

      // Find the net for this breadboard pin
      const breadboardPins = circuitState.breadboardPins[breadboardEndId] || [];
      const pinInfo = breadboardPins.find(p => p.pinId === breadboardPinId);

      console.log('[Wire-BB Debug] Looking for pin', breadboardPinId, 'in breadboard', breadboardEndId);
      console.log('[Wire-BB Debug] Found pinInfo:', pinInfo);

      if (pinInfo && pinInfo.net) {
        // Get the component type for the other end
        const otherComponent = circuitState.placedComponents.find(c => c.instanceId === otherComponentId);
        const otherComponentType = otherComponent?.definitionId || otherComponentId;

        console.log('[Wire-BB Debug] Adding', otherComponentType, '.', otherPinId, 'to net', pinInfo.net);

        if (!netGroups.has(pinInfo.net)) {
          netGroups.set(pinInfo.net, []);
        }

        // Check if this component+pin is already in the net (avoid duplicates)
        const existing = netGroups.get(pinInfo.net)!;
        const alreadyExists = existing.some(
          e => e.componentId === otherComponentId && e.pinId === otherPinId
        );

        if (!alreadyExists) {
          existing.push({
            componentId: otherComponentId,
            componentType: otherComponentType,
            pinId: otherPinId
          });
        }
      } else {
        console.log('[Wire-BB Debug] No net found for breadboard pin', breadboardPinId);
      }
    }
  }

  console.log('[Wire-BB Debug] Final netGroups:', Object.fromEntries(netGroups));
  return netGroups;
}

/**
 * Analyze power rail connections - find which breadboard power rails are connected to Arduino power/ground
 * Returns a map of power rail net -> source description (e.g., "power-top-plus" -> "Arduino 5V")
 */
function analyzePowerRailConnections(circuitState: CircuitState): Map<string, string> {
  const powerRails = new Map<string, string>();

  // Find Arduino component
  const arduino = circuitState.placedComponents.find(c =>
    c.definitionId.includes('arduino')
  );
  if (!arduino) return powerRails;

  // Find breadboard component(s)
  const breadboards = circuitState.placedComponents.filter(c =>
    c.definitionId.includes('breadboard')
  );
  if (breadboards.length === 0) return powerRails;

  // Check wires from Arduino to breadboard power rails
  for (const wire of circuitState.wires) {
    let arduinoPin: string | null = null;
    let breadboardInstanceId: string | null = null;
    let breadboardPinId: string | null = null;

    // Check if wire connects Arduino to breadboard
    if (wire.startComponentId === arduino.instanceId) {
      arduinoPin = wire.startPinId;
      const targetBreadboard = breadboards.find(b => b.instanceId === wire.endComponentId);
      if (targetBreadboard) {
        breadboardInstanceId = targetBreadboard.instanceId;
        breadboardPinId = wire.endPinId;
      }
    } else if (wire.endComponentId === arduino.instanceId) {
      arduinoPin = wire.endPinId;
      const targetBreadboard = breadboards.find(b => b.instanceId === wire.startComponentId);
      if (targetBreadboard) {
        breadboardInstanceId = targetBreadboard.instanceId;
        breadboardPinId = wire.startPinId;
      }
    }

    if (arduinoPin && breadboardInstanceId && breadboardPinId) {
      // Find the net for this breadboard pin
      const breadboardPins = circuitState.breadboardPins?.[breadboardInstanceId] || [];
      const pinInfo = breadboardPins.find(p => p.pinId === breadboardPinId);

      if (pinInfo?.net) {
        // Determine the power source type
        const pinLower = arduinoPin.toLowerCase();
        let sourceDesc = `Arduino ${arduinoPin}`;

        if (pinLower.includes('5v') || pinLower === 'vcc' || pinLower === 'vin') {
          sourceDesc = 'Arduino 5V (Power)';
        } else if (pinLower.includes('3v') || pinLower.includes('3.3v')) {
          sourceDesc = 'Arduino 3.3V (Power)';
        } else if (pinLower.includes('gnd') || pinLower === 'ground') {
          sourceDesc = 'Arduino GND (Ground)';
        }

        powerRails.set(pinInfo.net, sourceDesc);
      }
    }
  }

  return powerRails;
}

/**
 * Detect potential short circuits - when a component has multiple pins in the same breadboard row
 * This can cause short circuits (e.g., LED with both legs in same row, resistor with both terminals in same row)
 */
function detectShortCircuits(circuitState: CircuitState): Array<{
  componentId: string;
  componentType: string;
  pins: string[];
  net: string;
  message: string;
}> {
  const shortCircuits: Array<{
    componentId: string;
    componentType: string;
    pins: string[];
    net: string;
    message: string;
  }> = [];

  if (!circuitState.breadboardPins) {
    console.log('[Short Circuit Debug] No breadboardPins in circuitState');
    return shortCircuits;
  }

  for (const component of circuitState.placedComponents) {
    // Skip breadboard itself
    if (component.definitionId.includes('breadboard')) {
      continue;
    }

    if (!component.parentBreadboardId || !component.insertedPins) {
      console.log(`[Short Circuit Debug] Component ${component.definitionId} - no parentBreadboardId or insertedPins`, {
        parentBreadboardId: component.parentBreadboardId,
        insertedPins: component.insertedPins
      });
      continue;
    }

    const breadboardPins = circuitState.breadboardPins[component.parentBreadboardId] || [];
    console.log(`[Short Circuit Debug] Component ${component.definitionId} inserted into breadboard ${component.parentBreadboardId}`, {
      insertedPins: component.insertedPins,
      breadboardPinsCount: breadboardPins.length
    });

    // Group this component's pins by their net
    const pinsByNet = new Map<string, string[]>();

    for (const [componentPinId, breadboardPinId] of Object.entries(component.insertedPins)) {
      const pinInfo = breadboardPins.find(p => p.pinId === breadboardPinId);
      console.log(`[Short Circuit Debug] Pin ${componentPinId} -> ${breadboardPinId}, net: ${pinInfo?.net || 'NOT FOUND'}`);
      if (pinInfo && pinInfo.net) {
        if (!pinsByNet.has(pinInfo.net)) {
          pinsByNet.set(pinInfo.net, []);
        }
        pinsByNet.get(pinInfo.net)!.push(componentPinId);
      }
    }

    // Check for multiple pins in the same net (potential short circuit)
    for (const [net, pins] of pinsByNet.entries()) {
      if (pins.length > 1) {
        // This is a potential short circuit
        const componentName = component.definitionId.replace(/-/g, ' ');
        console.log(`[Short Circuit Debug] SHORT CIRCUIT DETECTED: ${componentName} pins ${pins.join(', ')} in ${net}`);
        shortCircuits.push({
          componentId: component.instanceId,
          componentType: component.definitionId,
          pins,
          net,
          message: `WARNING: ${componentName} has ${pins.length} pins (${pins.join(', ')}) in the same breadboard row (${net}). This creates a short circuit!`
        });
      }
    }
  }

  console.log(`[Short Circuit Debug] Total short circuits found: ${shortCircuits.length}`);
  return shortCircuits;
}

/**
 * Detect button wiring issues - when a button is bypassed because both connections
 * are on the same internally-connected side
 */
function detectButtonIssues(
  circuitState: CircuitState,
  netGroups: Map<string, Array<{componentId: string, componentType: string, pinId: string}>>
): Array<{
  componentId: string;
  message: string;
}> {
  const issues: Array<{componentId: string; message: string}> = [];

  for (const component of circuitState.placedComponents) {
    // Only check pushbuttons
    if (!component.definitionId.includes('pushbutton')) {
      continue;
    }

    if (!component.internalConnections?.whenPressed || !component.insertedPins) {
      continue;
    }

    // Get the always-connected pin groups
    const alwaysConnected = component.internalConnections.always || [];
    console.log(`[Button Debug] Checking button ${component.instanceId}, always connected groups:`, alwaysConnected);

    // For each always-connected group, check if multiple external connections come to the same group
    for (const group of alwaysConnected) {
      // Find which nets these pins are in
      const groupNets: string[] = [];
      for (const pinId of group) {
        const breadboardPinId = component.insertedPins[pinId];
        if (breadboardPinId && component.parentBreadboardId) {
          const breadboardPins = circuitState.breadboardPins?.[component.parentBreadboardId] || [];
          const pinInfo = breadboardPins.find(p => p.pinId === breadboardPinId);
          if (pinInfo?.net) {
            groupNets.push(pinInfo.net);
          }
        }
      }

      console.log(`[Button Debug] Pin group ${group.join(',')} is in nets:`, groupNets);

      // Check if any of these nets have other components connected
      let externalConnectionCount = 0;
      const connectedComponents: string[] = [];

      for (const net of groupNets) {
        const netComponents = netGroups.get(net) || [];
        for (const comp of netComponents) {
          // Skip the button itself
          if (comp.componentId === component.instanceId) continue;
          // Skip jump-wire markers
          if (comp.componentId === 'jump-wire') continue;

          externalConnectionCount++;
          connectedComponents.push(`${comp.componentType}.${comp.pinId}`);
        }
      }

      console.log(`[Button Debug] Group ${group.join(',')} has ${externalConnectionCount} external connections:`, connectedComponents);

      // If more than one external component connects to the same always-connected group,
      // the button might be bypassed
      if (externalConnectionCount >= 2) {
        issues.push({
          componentId: component.instanceId,
          message: `WARNING: Button pins ${group.join(' and ')} are always internally connected, but you have multiple circuit connections (${connectedComponents.join(', ')}) on this side. The button may not control the circuit properly - try connecting to opposite sides of the button (e.g., PIN1 side for power, PIN2 side for the next component).`
        });
      }
    }
  }

  console.log(`[Button Debug] Total button issues found: ${issues.length}`);
  return issues;
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

  // Analyze power rail connections (Arduino -> breadboard power rails)
  const powerRails = analyzePowerRailConnections(circuitState);

  // Detect potential short circuits
  const shortCircuits = detectShortCircuits(circuitState);

  // Detect button wiring issues
  const buttonIssues = detectButtonIssues(circuitState, breadboardNets);

  for (const component of circuitState.placedComponents) {
    // Skip breadboard itself in component listing
    if (component.definitionId.includes('breadboard')) {
      continue;
    }

    // Get wire connections for this component
    const wireConnections: string[] = [];
    for (const wire of circuitState.wires) {
      let thisPin: string | null = null;
      let otherComponentId: string | null = null;
      let otherPinId: string | null = null;

      if (wire.startComponentId === component.instanceId) {
        thisPin = wire.startPinId;
        otherComponentId = wire.endComponentId;
        otherPinId = wire.endPinId;
      } else if (wire.endComponentId === component.instanceId) {
        thisPin = wire.endPinId;
        otherComponentId = wire.startComponentId;
        otherPinId = wire.startPinId;
      }

      if (!thisPin || !otherComponentId || !otherPinId) continue;

      // Check if the other end is a breadboard power rail
      const otherComponent = circuitState.placedComponents.find(c => c.instanceId === otherComponentId);
      if (otherComponent?.definitionId.includes('breadboard')) {
        // This wire connects to breadboard - check if it's a power rail
        const breadboardPins = circuitState.breadboardPins?.[otherComponentId] || [];
        const pinInfo = breadboardPins.find(p => p.pinId === otherPinId);

        if (pinInfo?.net) {
          // Check if this net is powered
          const powerSource = powerRails.get(pinInfo.net);
          if (powerSource) {
            wireConnections.push(`    - ${thisPin} ↔ ${powerSource} (wire to breadboard ${pinInfo.net})`);
          } else {
            wireConnections.push(`    - ${thisPin} → breadboard.${otherPinId} (${pinInfo.net}) (wire)`);
          }
        } else {
          wireConnections.push(`    - ${thisPin} → breadboard.${otherPinId} (wire)`);
        }
      } else {
        // Regular wire to another component
        const otherDef = otherComponent?.definitionId || otherComponentId;
        wireConnections.push(`    - ${thisPin} → ${otherDef}.${otherPinId} (wire)`);
      }
    }

    // Get breadboard connections (pins connected via same breadboard row)
    const breadboardConnections: string[] = [];
    if (component.insertedPins) {
      for (const [pinId, breadboardPinId] of Object.entries(component.insertedPins)) {
        // Check if this pin is on a powered rail
        if (component.parentBreadboardId) {
          const breadboardPins = circuitState.breadboardPins?.[component.parentBreadboardId] || [];
          const pinInfo = breadboardPins.find(p => p.pinId === breadboardPinId);
          if (pinInfo?.net) {
            // Check if this net is powered by Arduino
            const powerSource = powerRails.get(pinInfo.net);
            if (powerSource) {
              breadboardConnections.push(`    - ${pinId} ↔ ${powerSource} (via breadboard ${pinInfo.net})`);
            }
          }
        }

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

  // Add power rail connections summary
  if (powerRails.size > 0) {
    contextParts.push('\n**Power Rail Connections:**');
    contextParts.push('(These breadboard rails are connected to Arduino power/ground via wires)');
    for (const [net, source] of powerRails.entries()) {
      contextParts.push(`- ${net} ← ${source}`);
    }
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

  // Add short circuit warnings (CRITICAL for circuit safety)
  if (shortCircuits.length > 0 || buttonIssues.length > 0) {
    contextParts.push('\n**⚠️ CIRCUIT PROBLEMS DETECTED:**');
    contextParts.push('(The following issues will prevent the circuit from working correctly)');
    for (const sc of shortCircuits) {
      contextParts.push(`- ${sc.message}`);
    }
    for (const bi of buttonIssues) {
      contextParts.push(`- ${bi.message}`);
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
  projectContext?: ProjectContext,
  conversationHistory?: ConversationMessage[]
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
        conversationHistory: conversationHistory || [],
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
