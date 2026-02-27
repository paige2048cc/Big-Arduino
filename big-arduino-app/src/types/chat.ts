/**
 * Chat Type Definitions
 *
 * Types for AI chat, component references, and highlighting.
 */

/**
 * Single component reference
 */
export interface ComponentReference {
  type: 'single';
  instanceId: string;           // Placed component instance
  definitionId: string;         // Component type (e.g., "led-5mm")
  displayName: string;          // "LED (Red)"
}

/**
 * Wire reference
 */
export interface WireReference {
  type: 'wire';
  wireId: string;
  displayName: string;          // "Wire (D13 → GND)"
  startComponent: string;
  startPin: string;
  endComponent: string;
  endPin: string;
}

/**
 * Multi-component reference (from box selection)
 */
export interface MultiComponentReference {
  type: 'multi';
  components: Array<{
    instanceId: string;
    definitionId: string;
  }>;
  displayName: string;          // "3 components" or "LED + Resistor"
}

/**
 * Union type for all reference types
 */
export type ChatReference = ComponentReference | WireReference | MultiComponentReference;

/**
 * Reference tag in chat input (before message sent)
 */
export interface PendingReference {
  reference: ChatReference;
  confirmed: boolean;           // false = semi-transparent (replaceable), true = opaque (additive)
}

/**
 * Chat message with optional references
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  references?: ChatReference[];  // Attached references when message was sent
}

/**
 * Chat input state for managing pending references
 */
export interface ChatInputState {
  pendingReferences: PendingReference[];
  isInputFocused: boolean;
}

/**
 * Highlight severity levels
 */
export type HighlightSeverity = 'error' | 'warning' | 'suggestion' | 'info';

/**
 * Highlighted item (component or wire)
 */
export interface HighlightItem {
  type: 'component' | 'wire';
  id: string;                   // instanceId for components, wireId for wires
  severity: HighlightSeverity;
  message?: string;             // Optional tooltip message
}

/**
 * Clickable issue in AI response
 */
export interface ClickableIssue {
  id: string;
  severity: HighlightSeverity;
  title: string;
  description: string;
  fix?: string;
  affectedItems: HighlightItem[];
}

/**
 * Helper function to create a component reference
 */
export function createComponentReference(
  instanceId: string,
  definitionId: string,
  displayName: string
): ComponentReference {
  return {
    type: 'single',
    instanceId,
    definitionId,
    displayName,
  };
}

/**
 * Helper function to create a wire reference
 */
export function createWireReference(
  wireId: string,
  startComponent: string,
  startPin: string,
  endComponent: string,
  endPin: string
): WireReference {
  return {
    type: 'wire',
    wireId,
    displayName: `Wire (${startPin} → ${endPin})`,
    startComponent,
    startPin,
    endComponent,
    endPin,
  };
}

/**
 * Helper function to create a multi-component reference
 */
export function createMultiComponentReference(
  components: Array<{ instanceId: string; definitionId: string; name: string }>
): MultiComponentReference {
  const count = components.length;
  let displayName: string;

  if (count <= 2) {
    displayName = components.map(c => c.name).join(' + ');
  } else {
    displayName = `${count} components`;
  }

  return {
    type: 'multi',
    components: components.map(c => ({
      instanceId: c.instanceId,
      definitionId: c.definitionId,
    })),
    displayName,
  };
}
