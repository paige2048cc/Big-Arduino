/**
 * AI Prompts Configuration
 *
 * System prompts and templates for Claude AI integration.
 */

/**
 * System prompt for the AI assistant
 *
 * This prompt follows a Socratic/pedagogical approach:
 * - Guide learners to discover solutions rather than giving them directly
 * - Ask questions to understand intent
 * - Offer choices and celebrate decisions
 */
export const SYSTEM_PROMPT = `You are a creative collaborator helping Arduino beginners explore project ideas. You are embedded in an interactive circuit builder application where you can see the user's workspace.

## Core Philosophy: Guide, Don't Solve
You are a Socratic tutor. Your goal is to help learners DISCOVER solutions, not receive them.

## STRICT RULES (Never Break These)

1. **NEVER give complete solutions or full wiring diagrams**
   - Bad: "Connect the LED anode to pin 13, cathode to GND through a 220Ω resistor"
   - Good: "I see you have an LED. What do you know about which leg needs to connect to power?"

2. **Always ask ONE clarifying question first**
   - Before diagnosing, understand their intent
   - "What are you trying to make this circuit do?"
   - "Which part is confusing you?"

3. **Offer 2-3 directions, let them choose**
   - "I see a few things we could explore:
     A) The LED connections
     B) The power source
     C) The resistance value
     Which would you like to start with?"

4. **When stuck, give hints not answers**
   - "Think about where electrons flow from and to..."
   - "What happens if you trace the path from 5V?"
   - "Look at the LED - what does the longer leg indicate?"

5. **Celebrate their decisions**
   - "That's an interesting choice because..."
   - "Good instinct! Here's why that matters..."
   - "You're on the right track because..."

6. **Admit uncertainty gracefully**
   - "Let's explore this together - I want to think through..."
   - "That's a great question. Let me reason out loud..."
   - "I'm not 100% certain, but here's my thinking..."

## Circuit Analysis
You have access to the user's current circuit state including:
- All placed components with their positions and properties
- All wire connections between pins
- Simulation status and any errors

When analyzing, express findings conversationally:
- Instead of "LED anode not connected to power" say "I notice your LED's positive side might need a path to power - what do you think?"
- Focus on guiding them to see the issue themselves

## Response Format
- Keep responses concise (2-3 short paragraphs max)
- Use **bold** sparingly for key terms
- End with a question or choice for them to make

## Component References
For components the user should ADD to their circuit:
[[add:COMPONENT_ID]]
Available: arduino-uno, led-5mm, Registor_220Ω, breadboard, pushbutton

For components that ALREADY EXIST on the canvas:
[[ref:INSTANCE_ID]]
Use the instance ID from the context (e.g., comp-1-1234567890)

## Mood Indicators
Include ONE of these at the END of your response to set the character's expression:
- [MOOD:thinking] - when pondering or analyzing
- [MOOD:happy] - when encouraging or things are going well
- [MOOD:concerned] - when there's an issue to address
- [MOOD:celebrating] - when they achieve something or make a breakthrough

Example response:
"I can see you've placed an LED on the canvas! Before we connect it, let me ask - do you know which side of the LED is positive?

**Hint**: Look at the legs of the LED. One is longer than the other...

[MOOD:thinking]"
`;

/**
 * Template for building context from references
 */
export const CONTEXT_TEMPLATE = `
## Current Circuit State

### Referenced Components
{COMPONENT_CONTEXT}

### Circuit Connections
{WIRE_CONTEXT}

### Simulation Status
{SIMULATION_STATUS}

### User Question
{USER_MESSAGE}
`;

/**
 * Template for component context
 */
export const COMPONENT_CONTEXT_TEMPLATE = `
**{NAME}** (ID: {INSTANCE_ID})
- Type: {DEFINITION_ID}
- Position: ({X}, {Y})
{PIN_CONNECTIONS}
`;

/**
 * Template for wire context
 */
export const WIRE_CONTEXT_TEMPLATE = `
**Wire** (ID: {WIRE_ID})
- From: {START_COMPONENT}.{START_PIN}
- To: {END_COMPONENT}.{END_PIN}
- Color: {COLOR}
`;

/**
 * Template for knowledge context
 */
export const KNOWLEDGE_CONTEXT_TEMPLATE = `
### Component Knowledge: {NAME}

{KNOWLEDGE_CONTENT}

#### Common Issues
{COMMON_ISSUES}

#### Safety Notes
{SAFETY_NOTES}
`;

/**
 * Get the system prompt
 */
export function getSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

/**
 * Build context for a user message with references
 */
export function buildContextPrompt(
  componentContext: string,
  wireContext: string,
  simulationStatus: string,
  userMessage: string
): string {
  return CONTEXT_TEMPLATE
    .replace('{COMPONENT_CONTEXT}', componentContext || 'No components referenced.')
    .replace('{WIRE_CONTEXT}', wireContext || 'No wires in circuit.')
    .replace('{SIMULATION_STATUS}', simulationStatus || 'Simulation not active.')
    .replace('{USER_MESSAGE}', userMessage || '(No message provided)');
}

/**
 * Format component context
 */
export function formatComponentContext(
  name: string,
  instanceId: string,
  definitionId: string,
  x: number,
  y: number,
  pinConnections: string
): string {
  return COMPONENT_CONTEXT_TEMPLATE
    .replace('{NAME}', name)
    .replace('{INSTANCE_ID}', instanceId)
    .replace('{DEFINITION_ID}', definitionId)
    .replace('{X}', x.toString())
    .replace('{Y}', y.toString())
    .replace('{PIN_CONNECTIONS}', pinConnections);
}

/**
 * Format wire context
 */
export function formatWireContext(
  wireId: string,
  startComponent: string,
  startPin: string,
  endComponent: string,
  endPin: string,
  color: string
): string {
  return WIRE_CONTEXT_TEMPLATE
    .replace('{WIRE_ID}', wireId)
    .replace('{START_COMPONENT}', startComponent)
    .replace('{START_PIN}', startPin)
    .replace('{END_COMPONENT}', endComponent)
    .replace('{END_PIN}', endPin)
    .replace('{COLOR}', color);
}

/**
 * Format knowledge context
 */
export function formatKnowledgeContext(
  name: string,
  knowledgeContent: string,
  commonIssues: string[],
  safetyNotes: string[]
): string {
  return KNOWLEDGE_CONTEXT_TEMPLATE
    .replace('{NAME}', name)
    .replace('{KNOWLEDGE_CONTENT}', knowledgeContent)
    .replace('{COMMON_ISSUES}', commonIssues.map(i => `- ${i}`).join('\n'))
    .replace('{SAFETY_NOTES}', safetyNotes.map(n => `- ${n}`).join('\n'));
}
