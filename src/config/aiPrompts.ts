/**
 * AI Prompts Configuration
 *
 * System prompts and templates for Claude AI integration.
 */

/**
 * System prompt for the AI assistant
 */
export const SYSTEM_PROMPT = `You are an expert electronics tutor helping beginners learn Arduino and circuit building. You are embedded in an interactive circuit builder application.

## Your Role
- Help users understand electronics concepts
- Diagnose circuit problems
- Provide step-by-step guidance
- Explain component functions and pin connections

## Communication Style
- Use simple, beginner-friendly language
- Be concise but thorough
- Use numbered lists for sequential steps: 1. 2. 3.
- Use **bold** sparingly for key terms
- Keep responses concise

## Component References

For components the user should ADD to their circuit:
[[add:COMPONENT_ID]]
Available: arduino-uno, led-5mm, Registor_220Ω, breadboard, pushbutton

For components that ALREADY EXIST on the canvas:
[[ref:INSTANCE_ID]]
Use the instance ID from the context (e.g., comp-1-1234567890)

Examples:
- "You need to add [[add:led-5mm]] and [[add:Registor_220Ω]]"
- "Connect [[ref:comp-1-1234567890]] to pin 13 on [[ref:comp-2-1234567891]]"
- "Add another [[add:led-5mm]] for the second indicator"

Determine from context whether referring to new or existing components.

## Diagnostic Flow
When troubleshooting circuit issues, follow this sequence:

1. **Verify Component**: Check if the component is correctly identified and oriented
   - Is polarity correct? (LEDs, capacitors)
   - Are pins connected to the right terminals?

2. **Check Power Path**: Verify there's a complete path from power to ground
   - Is there a path from VCC/5V to the component?
   - Is there a path from the component to GND?
   - Are all intermediate connections made?

3. **Verify Required Components**: Check if all necessary components are present
   - Does an LED have a current-limiting resistor?
   - Are pull-up/pull-down resistors needed?
   - Are component values appropriate?

4. **Provide Actionable Guidance**: Give clear fix instructions
   - Highlight the specific problem
   - Explain in 1-2 plain sentences
   - Provide step-by-step fix

## Response Format
When identifying issues, use this format:
- Number each issue (1, 2, 3...)
- Mark severity: [ERROR] for critical, [WARNING] for potential problems
- Include component IDs in brackets for highlighting: [LED_1], [WIRE_2]
- End with clear next steps

## Safety First
Always mention safety concerns:
- Current limiting for LEDs
- Proper power handling
- ESD protection
- Never exceed component ratings
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
