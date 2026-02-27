/**
 * Message Parser
 *
 * Parses AI message content for component references:
 * - [[add:component-id]] - Component to add (shows draggable card)
 * - [[ref:instance-id]] - Existing canvas component (shows clickable tag)
 *
 * Also integrates markdown parsing for text segments.
 */

import React from 'react';
import { ComponentItem, type ComponentData } from '../components/shared/ComponentItem';
import { ExistingComponentTag } from '../components/chat/ExistingComponentTag';
import { parseMarkdown } from './markdownParser';

// Component catalog - maps component IDs to their data
const COMPONENT_CATALOG: Record<string, { name: string; image: string; category: string }> = {
  'arduino-uno': { name: 'Arduino Uno', image: 'arduino-uno.png', category: 'microcontrollers' },
  'led-5mm': { name: 'LED (5mm)', image: 'LED_Red_OFF.png', category: 'passive' },
  'Registor_220Ω': { name: 'Resistor 220Ω', image: 'Registor_220Ω.png', category: 'passive' },
  'breadboard': { name: 'Half-Size Breadboard', image: 'breadboard.png', category: 'boards' },
  'pushbutton': { name: 'Push Button', image: 'pushbutton_OFF.png', category: 'passive' },
};

// Types for circuit state
interface PlacedComponent {
  instanceId: string;
  definitionId: string;
  properties?: Record<string, string | number>;
}

interface CircuitState {
  placedComponents: PlacedComponent[];
}

interface ParsedSegment {
  type: 'text' | 'add-component' | 'ref-component';
  content: string;
  componentId?: string;
  instanceId?: string;
}

/**
 * Parse a message and extract component references
 */
function parseMessage(content: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  const regex = /\[\[(add|ref):([^\]]+)\]\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: content.slice(lastIndex, match.index),
      });
    }

    const [, type, id] = match;

    if (type === 'add') {
      segments.push({
        type: 'add-component',
        content: match[0],
        componentId: id,
      });
    } else if (type === 'ref') {
      segments.push({
        type: 'ref-component',
        content: match[0],
        instanceId: id,
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      content: content.slice(lastIndex),
    });
  }

  return segments;
}

/**
 * Get display name for an instance ID by looking up in circuit state
 */
function getInstanceDisplayName(
  instanceId: string,
  circuitState?: CircuitState
): { displayName: string; definitionId: string } | null {
  if (!circuitState) return null;

  const component = circuitState.placedComponents.find(
    (c) => c.instanceId === instanceId
  );

  if (!component) return null;

  // Look up in catalog for display name
  const catalogEntry = COMPONENT_CATALOG[component.definitionId];
  const displayName = catalogEntry?.name || component.definitionId;

  return {
    displayName,
    definitionId: component.definitionId,
  };
}

interface RenderOptions {
  circuitState?: CircuitState;
  onExistingComponentClick?: (instanceId: string) => void;
}

/**
 * Render parsed message content as React elements
 */
export function renderMessageContent(
  content: string,
  options: RenderOptions = {}
): React.ReactNode {
  const { circuitState, onExistingComponentClick } = options;
  const segments = parseMessage(content);

  // Count add-component segments for scaling
  const addComponentCount = segments.filter((s) => s.type === 'add-component').length;

  // Group consecutive add-component segments
  const result: React.ReactNode[] = [];
  let componentCards: React.ReactNode[] = [];
  let componentIds: string[] = [];

  const flushComponentCards = () => {
    if (componentCards.length > 0) {
      result.push(
        <div key={`cards-${result.length}`} className="chat-component-cards">
          {componentCards}
        </div>
      );
      componentCards = [];
      // Note: Don't call onToolbarHighlight here - it causes render loops
      // Toolbar highlighting should be triggered by user interaction, not during render
      componentIds = [];
    }
  };

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    if (segment.type === 'text') {
      flushComponentCards();
      const trimmed = segment.content.trim();
      if (trimmed) {
        result.push(
          <span key={`text-${i}`} className="message-text-segment">
            {parseMarkdown(segment.content)}
          </span>
        );
      }
    } else if (segment.type === 'add-component' && segment.componentId) {
      const catalogEntry = COMPONENT_CATALOG[segment.componentId];

      if (catalogEntry) {
        const componentData: ComponentData = {
          id: segment.componentId,
          name: catalogEntry.name,
          image: catalogEntry.image,
        };

        componentCards.push(
          <ComponentItem
            key={`comp-${i}`}
            component={componentData}
            category={catalogEntry.category}
            size={addComponentCount > 2 ? 'compact' : 'normal'}
          />
        );
        componentIds.push(segment.componentId);
      } else {
        // Unknown component - render as text
        result.push(
          <span key={`unknown-${i}`} className="unknown-component">
            [{segment.componentId}]
          </span>
        );
      }
    } else if (segment.type === 'ref-component' && segment.instanceId) {
      flushComponentCards();

      const instanceInfo = getInstanceDisplayName(segment.instanceId, circuitState);

      if (instanceInfo) {
        result.push(
          <ExistingComponentTag
            key={`ref-${i}`}
            instanceId={segment.instanceId}
            displayName={instanceInfo.displayName}
            definitionId={instanceInfo.definitionId}
            onClick={onExistingComponentClick || (() => {})}
          />
        );
      } else {
        // Instance not found - render as text
        result.push(
          <span key={`notfound-${i}`} className="unknown-reference">
            [{segment.instanceId}]
          </span>
        );
      }
    }
  }

  // Flush any remaining component cards
  flushComponentCards();

  return <>{result}</>;
}

/**
 * Check if a message contains any component references
 */
export function hasComponentReferences(content: string): boolean {
  return /\[\[(add|ref):[^\]]+\]\]/.test(content);
}

export default renderMessageContent;
