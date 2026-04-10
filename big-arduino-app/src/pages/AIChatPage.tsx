import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, Loader2, ChevronRight, Cpu, Package, Check, Lightbulb, RotateCcw } from 'lucide-react';
import { Sidebar } from '../components/layout/Sidebar';
import { BlueCharacter } from '../components/ai/BlueCharacter';
import type { DetectedComponent, ProjectMatch } from '../utils/componentMatcher';
import { matchProjects, getChipClass } from '../utils/componentMatcher';
import { sendMessage, parseAIResponse, isAIServiceConfigured, type CircuitState, type ConversationMessage } from '../services/aiService';
import { parseMarkdown } from '../utils/markdownParser';
import './AIChatPage.css';

type StageId = 'seed' | 'play' | 'amplify' | 'realize';
type SeedQuestionId = 'question1' | 'question2' | 'question3';
type DifficultyLevel = 'easy' | 'medium' | 'hard';
type AmplifyActionId = 'expand' | 'combine' | 'decompose' | 'challenge';
type EntryModeId = 'many-ideas' | 'have-components' | 'dont-know' | 'optimize-existing';

interface StageCardData {
  stage: StageId;
  title: string;
  description: string;
}

interface SeedQuestionCard {
  id: SeedQuestionId;
  index: number;
  total: number;
  prompt: string;
  hint?: string;
}

interface SelectionCardOption {
  id: string;
  label: string;
  description: string;
  meta?: string;
  disabled?: boolean;
}

interface SelectionCardData {
  kind: 'entry-state' | 'directions' | 'actions';
  title: string;
  subtitle: string;
  options: SelectionCardOption[];
  multiSelect: boolean;
  maxSelections: number;
  selectedIds: string[];
  confirmLabel: string;
  submitted?: boolean;
  columns?: 1 | 2;
  helperText?: string;
}

interface InsightCardData {
  title: string;
  subtitle?: string;
  items: {
    title: string;
    description: string;
    badge?: string;
  }[];
}

interface EvaluationCardData {
  title: string;
  difficulty: DifficultyLevel;
  tagline: string;
  creativeEvaluation: string;
  technicalEvaluation: string;
  components: string[];
  timeEstimate: string;
  hardestPart: string;
  tradeoff: string;
}

interface BreakdownCardData {
  title: string;
  steps: string[];
  note: string;
}

interface ComponentNeed {
  name: string;
  purpose: string;
}

interface BrainstormIdea {
  id: string;
  title: string;
  difficulty: DifficultyLevel;
  hook: string;
  whatItDoes: string;
  components: ComponentNeed[];
}

interface IdeaCardsData {
  title?: string;
  subtitle?: string;
  ideas: BrainstormIdea[];
  selectable?: boolean;
  selectedId?: string | null;
  submitted?: boolean;
  confirmLabel?: string;
  helperText?: string;
}

interface FinalProjectData {
  title: string;
  difficulty: DifficultyLevel;
  hook: string;
  whatItDoes: string;
  components: ComponentNeed[];
  summary: string;
}

interface TwistCalloutData {
  title: string;
  content: string;
}

interface ActionButtonsData {
  buttons: {
    id: 'start-project' | 'restart';
    label: string;
  }[];
}

interface BrainstormDirection {
  id: string;
  lens: string;
  title: string;
  description: string;
}

interface AmplifyResult {
  intro: string;
  ideas: BrainstormIdea[];
  helperText?: string;
  breakdown?: BreakdownCardData | null;
}

interface ChallengePlan {
  intro: string;
  questions: string[];
}

interface RealizeResult {
  intro: string;
  project: FinalProjectData;
  breakdown?: BreakdownCardData | null;
  twist?: string;
}

interface BrainstormSession {
  source: 'home' | 'scanner';
  entryMode: EntryModeId | null;
  stage: StageId;
  currentQuestion: SeedQuestionId | 'question1-followup' | 'idea-description' | 'project-description' | null;
  answers: Partial<Record<SeedQuestionId, string>>;
  knownComponents: string[];
  directions: BrainstormDirection[];
  selectedDirectionIds: string[];
  selectedActionId: AmplifyActionId | null;
  lastAmplifyResult: AmplifyResult | null;
  amplifyIdeas: BrainstormIdea[];
  selectedIdeaId: string | null;
  askedSeedFollowUp: boolean;
  pendingInitialInput: string | null;
  challengeQuestions: string[];
  challengeAnswers: string[];
  challengeQuestionIndex: number;
  awaitingChallengeAnswer: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  componentTags?: DetectedComponent[];
  choiceQuestion?: {
    question: string;
    options: { id: string; label: string; description: string; icon: 'learning' | 'exploring' }[];
  };
  projectCards?: {
    matches: ProjectMatch[];
    bestMatchIntro: string;
  };
  stageCard?: StageCardData;
  seedQuestion?: SeedQuestionCard;
  selectionCard?: SelectionCardData;
  insightCard?: InsightCardData;
  evaluationCard?: EvaluationCardData;
  breakdownCard?: BreakdownCardData;
  ideaCards?: IdeaCardsData;
  finalProject?: FinalProjectData;
  twistCallout?: TwistCalloutData;
  actionButtons?: ActionButtonsData;
}

const COMPONENT_KEYWORDS = [
  { label: 'LED', definitionId: 'led-5mm', keywords: ['led', 'leds', 'light-emitting diode', 'light bulb', 'lamp'] },
  { label: 'Buzzer', definitionId: 'buzzer', keywords: ['buzzer', 'piezo'] },
  { label: 'Button', definitionId: 'pushbutton', keywords: ['button', 'push button', 'pushbutton', 'switch'] },
  { label: 'Potentiometer', definitionId: 'potentiometer', keywords: ['potentiometer', 'knob'] },
  { label: 'Photoresistor', definitionId: 'photoresistor', keywords: ['photoresistor', 'ldr', 'light sensor'] },
  { label: 'Ultrasonic Sensor', definitionId: 'ultrasonic-sensor', keywords: ['ultrasonic', 'hc-sr04', 'distance sensor'] },
  { label: 'PIR Sensor', definitionId: 'pir-sensor', keywords: ['pir', 'motion sensor'] },
  { label: 'Temperature Sensor', definitionId: 'temperature-sensor', keywords: ['temperature sensor', 'lm35', 'dht11'] },
  { label: 'Soil Moisture Sensor', definitionId: 'soil-moisture-sensor', keywords: ['soil moisture', 'moisture sensor'] },
  { label: 'Servo', definitionId: 'servo', keywords: ['servo', 'servo motor'] },
  { label: 'LCD Display', definitionId: 'lcd-display', keywords: ['lcd', 'lcd display'] },
  { label: 'OLED Display', definitionId: 'oled-display', keywords: ['oled', 'oled display'] },
];

const PLAY_LENSES = [
  { id: 'reality-extension', label: 'Reality extension' },
  { id: 'cross-domain-transfer', label: 'Cross-domain transfer' },
  { id: 'logic-reversal', label: 'Logic reversal' },
  { id: 'social-connection', label: 'Social connection' },
  { id: 'gamification', label: 'Gamification' },
  { id: 'identity', label: 'Identity' },
  { id: 'technical-challenge', label: 'Technical challenge' },
  { id: 'minimalism', label: 'Minimalism' },
];

const AMPLIFY_ACTIONS: { id: AmplifyActionId; title: string; description: string }[] = [
  { id: 'expand', title: 'Deepen', description: 'Expand your chosen direction so you can see what it does and imagine it more vividly.' },
  { id: 'combine', title: 'Combine', description: 'Merge the directions you picked into a stronger concept built from those choices.' },
  { id: 'decompose', title: 'Break Down', description: 'Split the selected project into small executable steps you can actually build.' },
  { id: 'challenge', title: 'Challenge', description: 'I will ask you some sharp questions to help you reflect on what really makes the idea meaningful.' },
];

const ENTRY_MODE_OPTIONS: { id: EntryModeId; label: string; description: string }[] = [
  {
    id: 'many-ideas',
    label: "I have lots of ideas, but I don't know how to make them happen",
    description: 'Describe the idea you want to move forward, and we will focus on making it buildable.',
  },
  {
    id: 'have-components',
    label: "I have components, but I don't know what to make",
    description: 'Start from the parts you already have and explore directions from there.',
  },
  {
    id: 'dont-know',
    label: "I don't know where to start",
    description: 'We can begin with a feeling, theme, or small curiosity and open it up together.',
  },
  {
    id: 'optimize-existing',
    label: 'I built something before, but I want to improve it',
    description: 'Describe the existing project first, then we will branch out from that project instead of starting from scratch.',
  },
];

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function detectMentionedComponents(text: string): string[] {
  const lower = text.toLowerCase();
  return COMPONENT_KEYWORDS
    .filter(item => item.keywords.some(keyword => lower.includes(keyword)))
    .map(item => item.label);
}

function extractKnownComponents(detected: DetectedComponent[] | undefined, text?: string): string[] {
  const fromDetected = (detected || []).map(item => item.className);
  const fromText = text ? detectMentionedComponents(text) : [];
  return uniqueStrings([...fromDetected, ...fromText]);
}

function formatKnownComponentsAnswer(components: string[]) {
  if (components.length === 0) return '';
  return `Known or already mentioned components: ${components.join(', ')}.`;
}

function normalizeDifficulty(value: string | undefined): DifficultyLevel {
  const lower = (value || '').toLowerCase();
  if (lower.includes('hard') || lower.includes('advanced')) return 'hard';
  if (lower.includes('medium') || lower.includes('intermediate')) return 'medium';
  return 'easy';
}

function cleanInlineMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .trim();
}

function normalizeComponentNeeds(components: unknown): ComponentNeed[] {
  if (!Array.isArray(components)) return [];

  return components
    .map((item) => {
      if (typeof item === 'string') {
        return { name: cleanInlineMarkdown(item), purpose: '' };
      }

      if (item && typeof item === 'object' && 'name' in item && 'purpose' in item) {
        const component = item as { name?: string; purpose?: string };
        return {
          name: cleanInlineMarkdown(component.name || ''),
          purpose: cleanInlineMarkdown(component.purpose || ''),
        };
      }

      return null;
    })
    .filter((item): item is ComponentNeed => !!item && !!item.name);
}

function normalizeIdea(rawIdea: Partial<BrainstormIdea>, fallbackId: string): BrainstormIdea {
  return {
    id: rawIdea.id || fallbackId,
    title: cleanInlineMarkdown(rawIdea.title || 'Project direction'),
    difficulty: normalizeDifficulty(rawIdea.difficulty),
    hook: cleanInlineMarkdown(rawIdea.hook || ''),
    whatItDoes: cleanInlineMarkdown(rawIdea.whatItDoes || ''),
    components: normalizeComponentNeeds(rawIdea.components),
  };
}

function normalizeSearchText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function inferComponentDefinitionId(text: string): string | null {
  const normalized = normalizeSearchText(text);
  if (!normalized) return null;

  if (normalized.includes('arduino')) return 'arduino-uno';
  if (normalized.includes('breadboard')) return 'breadboard';
  if (normalized.includes('resistor')) return 'registor_220ω';

  const keywordMatch = COMPONENT_KEYWORDS.find(item =>
    item.keywords.some(keyword => normalized.includes(normalizeSearchText(keyword)))
  );
  return keywordMatch?.definitionId || null;
}

function summarizeStepTitle(stepText: string, fallbackTitle: string): string {
  const cleaned = cleanInlineMarkdown(stepText)
    .replace(/^step\s*\d+[:.)\-\s]*/i, '')
    .replace(/^\d+[:.)\-\s]*/, '')
    .replace(/^[•\-]\s*/, '')
    .trim();

  if (!cleaned) return fallbackTitle;
  const summary = cleaned.split(/[.!?;:]/)[0]?.trim() || cleaned;
  return summary.length > 60 ? `${summary.slice(0, 57).trim()}...` : summary;
}

function buildStartProjectConfig(message: ChatMessage) {
  const firstStep = cleanInlineMarkdown(message.breakdownCard?.steps?.[0] || '');
  const finalProject = message.finalProject;
  const fallbackTitle = finalProject?.title || 'AI Project';
  const titleSummary = summarizeStepTitle(firstStep, fallbackTitle);

  const inferredIds = uniqueStrings([
    ...((firstStep ? [firstStep] : []).map(inferComponentDefinitionId).filter((id): id is string => !!id)),
    ...((finalProject?.components || [])
      .map(component => inferComponentDefinitionId(component.name))
      .filter((id): id is string => !!id)),
  ]);

  const stepComponentIds = uniqueStrings([
    'arduino-uno',
    'breadboard',
    ...inferredIds,
  ]);

  return {
    projectTitle: `Step 1: ${titleSummary}`,
    projectComponentIds: stepComponentIds,
    projectComponentSummary: firstStep || `Start with the MVP for ${fallbackTitle}.`,
    initialChatMessages: [
      {
        role: 'assistant' as const,
        content: firstStep
          ? `Let's start with step 1: ${firstStep}`
          : `Let's start with the MVP for ${fallbackTitle}.`,
      },
    ],
  };
}

function buildEntryStateSelectionCard(): SelectionCardData {
  return {
    kind: 'entry-state',
    title: 'How would you describe your current situation?',
    subtitle: 'Pick the option that feels closest.',
    options: ENTRY_MODE_OPTIONS.map(option => ({
      id: option.id,
      label: option.label,
      description: option.description,
    })),
    multiSelect: false,
    maxSelections: 1,
    selectedIds: [],
    confirmLabel: 'Continue',
    columns: 1,
  };
}

function extractJsonPayload(raw: string) {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  const startIndex = candidate.indexOf('{');
  const endIndex = candidate.lastIndexOf('}');
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('No JSON object found');
  }
  return JSON.parse(candidate.slice(startIndex, endIndex + 1));
}

function buildBrainstormCircuitState(detected: DetectedComponent[] | undefined): CircuitState {
  return {
    placedComponents: (detected || []).map((d, index) => ({
      instanceId: `detected-${index}`,
      definitionId: d.className,
      x: 0,
      y: 0,
    })),
    wires: [],
    isSimulating: false,
  };
}

function buildDirectionsFallback(session: BrainstormSession): { intro: string; directions: BrainstormDirection[] } {
  const seed = session.answers.question1 || session.answers.question3 || 'your idea';
  const components = session.knownComponents.length > 0 ? session.knownComponents.join(', ') : 'simple Arduino components';
  return {
    intro: session.entryMode === 'optimize-existing'
      ? `Your current project already has a strong core: **${seed}**. Here are eight ways to evolve it without locking into one solution too early.`
      : `Your starting point is already clear: **${seed}**. Here are eight different ways to open it up without ranking them too early.`,
    directions: PLAY_LENSES.map((lens, index) => ({
      id: lens.id,
      lens: lens.label,
      title: `${lens.label.split(' ')[0]} concept ${index + 1}`,
      description: `Use ${components} to explore ${seed.toLowerCase()} through a ${lens.label.toLowerCase()} angle.`,
    })),
  };
}

function buildAmplifyFallback(session: BrainstormSession): AmplifyResult {
  const selected = session.directions.filter(direction => session.selectedDirectionIds.includes(direction.id));
  const action = session.selectedActionId || 'expand';
  const baseParts = session.knownComponents.length > 0 ? session.knownComponents : ['Arduino Uno', 'Breadboard', 'Jumper wires'];
  const focus = selected[0];

  if (action === 'decompose') {
    return {
      intro: `Let's turn **${focus?.title || 'this idea'}** into a path you could actually build. I’d start with a tiny version first, then layer in the richer behavior later.`,
      ideas: [
        {
          id: 'decompose-mvp',
          title: `${focus?.title || 'Core idea'} MVP`,
          difficulty: 'easy',
          hook: 'Start with one small behavior that proves the project works at all.',
          whatItDoes: 'This version focuses on the core interaction only, so you can build confidence before adding anything extra.',
          components: [
            { name: baseParts[0], purpose: 'Runs the first prototype logic.' },
            { name: baseParts[1] || 'LED', purpose: 'Provides the clearest first feedback.' },
            { name: baseParts[2] || 'Buzzer', purpose: 'Adds one more expressive signal only if needed.' },
          ],
        },
      ],
      breakdown: {
        title: 'A simple build path',
        steps: [
          `Make a tiny MVP version of **${focus?.title || 'the idea'}** that proves the core interaction.`,
          'Add one richer output or sensor only after the MVP works reliably.',
          'Refine the timing, behavior, and atmosphere so the project feels intentional.',
        ],
        note: 'Keep the first version small enough that you can finish it without getting overwhelmed.',
      },
      helperText: 'If this path feels right, continue and I’ll turn it into a fuller project direction.',
    };
  }

  if (action === 'challenge') {
    return {
      intro: 'I’m going to ask a few sharp questions, one at a time, so we can understand what would make this idea genuinely interesting.',
      ideas: [],
      helperText: 'Answer the question in the chat, and I’ll keep going.',
    };
  }

  if (action === 'combine' && selected.length > 1) {
    return {
      intro: 'Here’s what happens if we fuse the directions you picked into something stronger and more layered, while staying faithful to your choices.',
      ideas: [
        {
          id: 'combine-balanced',
          title: `${selected[0].title} + ${selected[1].title}`,
          difficulty: 'medium',
          hook: 'A stronger concept built directly from the two directions you chose.',
          whatItDoes: `This project combines ${selected[0].description.toLowerCase()} with ${selected[1].description.toLowerCase()} so the result feels more ambitious and more memorable than either one alone.`,
          components: [
            { name: baseParts[0], purpose: 'Handles the combined behavior.' },
            { name: baseParts[1] || 'Primary sensor', purpose: 'Detects the main event.' },
            { name: 'LED', purpose: 'Creates an expressive visual layer.' },
            { name: 'Buzzer', purpose: 'Adds another emotional cue.' },
          ],
        },
        {
          id: 'combine-bold',
          title: `${selected[0].title} reimagined`,
          difficulty: 'hard',
          hook: 'A more complex version that pushes the same combination into a fuller experience.',
          whatItDoes: 'This version keeps the same core pairing, but turns it into something more immersive with richer feedback and more moving parts.',
          components: [
            { name: baseParts[0], purpose: 'Runs the expanded interaction logic.' },
            { name: baseParts[1] || 'Sensor module', purpose: 'Tracks the main trigger.' },
            { name: 'LED', purpose: 'Builds a stronger visual response.' },
            { name: 'Buzzer', purpose: 'Adds tension or rhythm.' },
            { name: 'Optional extra sensor', purpose: 'Lets the project respond in a richer way.' },
          ],
        },
      ],
      helperText: 'Choose the version that feels closest to what you want to build.',
    };
  }

  return {
    intro: `Let’s deepen **${focus?.title || 'this direction'}** so you can feel what the project actually does and picture it more clearly.`,
    ideas: selected.slice(0, 3).map((direction, index) => ({
      id: `${direction.id}-deepen-${index + 1}`,
      title: index === 0 ? direction.title : `${direction.title} variation ${index + 1}`,
      difficulty: index === 0 ? 'medium' : index === 1 ? 'easy' : 'hard',
      hook: index === 0
        ? 'A buildable version that still feels vivid and expressive.'
        : index === 1
          ? 'A simpler version that proves the interaction quickly.'
          : 'A more ambitious version that pushes the same core feeling further.',
      whatItDoes: index === 0
        ? `It starts from ${direction.description.toLowerCase()} and turns it into a clearer interaction. Imagine the project reacting in real time, making the behavior feel legible, alive, and a little cinematic.`
        : index === 1
          ? `This is the leaner version of the same idea: fewer parts, a faster build, and a clearer first success while keeping the original concept recognizable.`
          : `This version expands the same idea into something more immersive, with richer feedback and a stronger sense of atmosphere once the interaction starts.`,
      components: [
        { name: baseParts[0], purpose: 'Acts as the control center for the project.' },
        { name: baseParts[1] || 'Sensor module', purpose: 'Captures the input or condition that drives the idea.' },
        { name: 'LED', purpose: 'Gives visible feedback.' },
        ...(index > 0 ? [{ name: 'Buzzer', purpose: 'Adds audio or tension when the interaction changes.' }] : []),
      ],
    })),
    helperText: 'Choose one direction to turn into a complete project description.',
  };
}

function buildRealizeFallback(session: BrainstormSession, amplify: AmplifyResult): RealizeResult {
  const chosenIdea = session.amplifyIdeas.find(idea => idea.id === session.selectedIdeaId) || amplify.ideas[0];
  const difficulty = chosenIdea?.difficulty || 'medium';
  return {
    intro: 'This feels like a strong direction. Here’s a fuller version you could actually build next.',
    project: {
      title: chosenIdea?.title || 'New Arduino concept',
      difficulty,
      hook: chosenIdea?.hook || 'A buildable idea shaped by your original prompt.',
      whatItDoes: chosenIdea?.whatItDoes || 'This version turns the idea into a concrete Arduino interaction with a clear input and response.',
      components: chosenIdea?.components || [],
      summary: 'It keeps the feeling you started with, but now it has a clearer build path and a small enough first version to begin with.',
    },
    breakdown: difficulty === 'easy'
      ? null
      : {
          title: 'Project breakdown',
          steps: [
            'Build the smallest MVP that proves the core interaction.',
            'Add one more sensor or feedback layer only after the MVP works.',
            'Polish the behavior so it feels intentional instead of crowded.',
          ],
          note: 'Keep the steps short so the project feels buildable, not overwhelming.',
        },
    twist: 'Maybe you could add one extra sensory detail later, like a sudden glow shift or a small sound cue, just to make the project feel more alive.',
  };
}

function buildDirectionsPrompt(session: BrainstormSession) {
  return `BRAINSTORM_JSON::
Create the P stage directions for an Arduino brainstorming flow.

Entry mode:
- ${session.entryMode || 'none'}

User seed answers:
- Question 1: ${session.answers.question1 || 'N/A'}
- Question 2: ${session.answers.question2 || 'N/A'}
- Question 3: ${session.answers.question3 || 'N/A'}
- Known components: ${session.knownComponents.join(', ') || 'None explicitly known'}

Return valid JSON only. No markdown fences. No extra prose.
Schema:
{
  "intro": "string",
  "directions": [
    { "id": "string", "lens": "string", "title": "string", "description": "string" }
  ]
}

Rules:
- Return exactly 8 directions.
- Use these 8 lenses in this exact order:
  1. Reality extension
  2. Cross-domain transfer
  3. Logic reversal
  4. Social connection
  5. Gamification
  6. Identity
  7. Technical challenge
  8. Minimalism
- Map the ids to:
  "reality-extension", "cross-domain-transfer", "logic-reversal", "social-connection", "gamification", "identity", "technical-challenge", "minimalism"
- Each title should be short.
- Each description should be one clear sentence, max 24 words.
- Do not rank or score the ideas.
- Do not use Easy/Medium/Hard labels here.
- Preserve ownership by sounding like these ideas are growing from the user’s words, not replacing them.
- If entry mode is "many-ideas", treat Question 1 as the idea they want help executing.
- If entry mode is "optimize-existing", treat Question 1 as the existing project and generate directions that evolve, improve, remix, or sharpen that project.
- If entry mode is "have-components" or "dont-know", use the normal brainstorming style.
- Keep the ideas realistically buildable with Arduino and named extra parts when needed.`;
}

function buildAmplifyPrompt(session: BrainstormSession) {
  const selected = session.directions.filter(direction => session.selectedDirectionIds.includes(direction.id));
  const selectedText = selected.map(direction => `- ${direction.title} (${direction.lens}): ${direction.description}`).join('\n');
  if (session.selectedActionId === 'decompose') {
    return `BRAINSTORM_JSON::
Create the A stage "Break Down" response for an Arduino brainstorming flow.

User seed answers:
- Question 1: ${session.answers.question1 || 'N/A'}
- Question 2: ${session.answers.question2 || 'N/A'}
- Question 3: ${session.answers.question3 || 'N/A'}

Selected directions:
${selectedText || '- None'}

Return valid JSON only. No markdown fences. No extra prose.
Schema:
{
  "intro": "string",
  "ideas": [
    {
      "id": "string",
      "title": "string",
      "difficulty": "easy | medium | hard",
      "hook": "string",
      "whatItDoes": "string",
      "components": [
        { "name": "string", "purpose": "string" }
      ]
    }
  ],
  "breakdown": {
    "title": "string",
    "steps": ["string"],
    "note": "string"
  },
  "helperText": "string"
}

Rules:
- Focus on one selected direction and explain what the project is.
- The breakdown should split the project into 2-4 executable steps.
- The first step must be a tiny MVP.
- Keep it practical, clear, and not overwhelming.`;
  }

  return `BRAINSTORM_JSON::
Create the A stage response for an Arduino brainstorming flow.

User seed answers:
- Question 1: ${session.answers.question1 || 'N/A'}
- Question 2: ${session.answers.question2 || 'N/A'}
- Question 3: ${session.answers.question3 || 'N/A'}

Selected directions:
${selectedText || '- None'}

Chosen action: ${session.selectedActionId}

Return valid JSON only. No markdown fences. No extra prose.
Schema:
{
  "intro": "string",
  "ideas": [
    {
      "id": "string",
      "title": "string",
      "difficulty": "easy | medium | hard",
      "hook": "string",
      "whatItDoes": "string",
      "components": [
        { "name": "string", "purpose": "string" }
      ]
    }
  ],
  "helperText": "string"
}

Rules:
- Follow the chosen action closely:
  - expand: deepen the selected direction(s)
  - combine: only combine the directions the user selected
  - challenge: do not use this schema
- Return 2-4 ideas.
- Each idea should feel like a real project direction, not a short note.
- Each idea must include a short hook, a concise "what it does" paragraph, and a components list with purpose for each component.
- Keep the tone close to the main branch exploring style: vivid, warm, and practical.
- Include difficulty labels directly in the data.
- For expand: explain what the project can do, and include at least one vivid, concrete example or scene.
- For combine: build only from the selected directions, and make the merged concept stronger or more complex while staying grounded in them.
- Stay grounded in Arduino reality and the known components.`;
}

function buildChallengeQuestionsPrompt(session: BrainstormSession) {
  const selected = session.directions.filter(direction => session.selectedDirectionIds.includes(direction.id));
  const selectedText = selected.map(direction => `- ${direction.title} (${direction.lens}): ${direction.description}`).join('\n');
  return `BRAINSTORM_JSON::
Create challenge questions for the A stage of an Arduino brainstorming flow.

User seed answers:
- Question 1: ${session.answers.question1 || 'N/A'}
- Question 2: ${session.answers.question2 || 'N/A'}
- Question 3: ${session.answers.question3 || 'N/A'}

Selected directions:
${selectedText || '- None'}

Return valid JSON only. No markdown fences. No extra prose.
Schema:
{
  "intro": "string",
  "questions": ["string"]
}

Rules:
- Return 2-3 questions total.
- Ask questions that help the user reflect more deeply on meaning, audience, tension, purpose, or tradeoffs.
- Do not generate solutions yet.`;
}

function buildChallengeSynthesisPrompt(session: BrainstormSession) {
  const selected = session.directions.filter(direction => session.selectedDirectionIds.includes(direction.id));
  const selectedText = selected.map(direction => `- ${direction.title} (${direction.lens}): ${direction.description}`).join('\n');
  const qaText = session.challengeQuestions.map((question, index) => {
    const answer = session.challengeAnswers[index] || 'No answer';
    return `Q${index + 1}: ${question}\nA${index + 1}: ${answer}`;
  }).join('\n');

  return `BRAINSTORM_JSON::
Create improved A stage ideas after challenge questions in an Arduino brainstorming flow.

User seed answers:
- Question 1: ${session.answers.question1 || 'N/A'}
- Question 2: ${session.answers.question2 || 'N/A'}
- Question 3: ${session.answers.question3 || 'N/A'}

Selected directions:
${selectedText || '- None'}

Challenge question answers:
${qaText}

Return valid JSON only. No markdown fences. No extra prose.
Schema:
{
  "intro": "string",
  "ideas": [
    {
      "id": "string",
      "title": "string",
      "difficulty": "easy | medium | hard",
      "hook": "string",
      "whatItDoes": "string",
      "components": [
        { "name": "string", "purpose": "string" }
      ]
    }
  ],
  "helperText": "string"
}

Rules:
- Start from the user’s answers and make the project feel more clearly understood now.
- Return 2-3 improved ideas.
- Keep the ideas focused, vivid, and practical.`;
}

function buildRealizePrompt(session: BrainstormSession, selectedIdea: BrainstormIdea) {
  return `BRAINSTORM_JSON::
Create the R stage output for an Arduino brainstorming flow.

User seed answers:
- Question 1: ${session.answers.question1 || 'N/A'}
- Question 2: ${session.answers.question2 || 'N/A'}
- Question 3: ${session.answers.question3 || 'N/A'}
- Known components: ${session.knownComponents.join(', ') || 'None explicitly known'}

Selected directions:
${session.directions.filter(direction => session.selectedDirectionIds.includes(direction.id)).map(direction => `- ${direction.title}: ${direction.description}`).join('\n')}

Chosen Stage A idea:
- Title: ${selectedIdea.title}
- Difficulty: ${selectedIdea.difficulty}
- Hook: ${selectedIdea.hook}
- What it does: ${selectedIdea.whatItDoes}
- Components:
${selectedIdea.components.map(component => `  - ${component.name}: ${component.purpose}`).join('\n')}

Return valid JSON only. No markdown fences. No extra prose.
Schema:
{
  "intro": "string",
  "project": {
    "title": "string",
    "difficulty": "easy | medium | hard",
    "hook": "string",
    "whatItDoes": "string",
    "components": [
      { "name": "string", "purpose": "string" }
    ],
    "summary": "string"
  },
  "breakdown": {
    "title": "string",
    "steps": ["string"],
    "note": "string"
  } | null,
  "twist": "string"
}

Rules:
- Keep the tone close to the main branch project descriptions: warm, vivid, and practical.
- The intro should be 1-2 sentences, not a large block.
- The project should read like a complete, buildable project introduction.
- If difficulty is medium or hard, breakdown is required and must contain 2-4 steps.
- The first breakdown step must be a tiny MVP, like lighting one LED or making a buzzer beep.
- Keep the breakdown short enough to avoid overwhelm.
- If difficulty is easy, set breakdown to null.
- The twist should feel optional and lightweight, as an extra playful thought, not part of the core project.`;
}

export function AIChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as {
    screenshot?: string;
    detected?: DetectedComponent[];
    initialMessage?: string;
  } | null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [choiceMade, setChoiceMade] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [brainstormSession, setBrainstormSession] = useState<BrainstormSession | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const buildConversationHistory = (msgs: ChatMessage[]): ConversationMessage[] =>
    msgs
      .filter(msg => msg.content)
      .map(msg => ({
        role: msg.role,
        content: msg.content!,
      }));

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'difficulty-beginner';
      case 'intermediate':
        return 'difficulty-intermediate';
      case 'advanced':
        return 'difficulty-advanced';
      default:
        return '';
    }
  };

  const getBrainstormDifficultyClass = (difficulty: DifficultyLevel) => `brainstorm-difficulty--${difficulty}`;
  const formatDifficultyLabel = (difficulty: DifficultyLevel) => difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

  const stripComponentRefs = (content: string): string =>
    content.replace(/\[\[(add|ref):[^\]]+\]\]\s*/g, '');

  const activeIdeaSelectionMessage = useMemo(
    () => [...messages].reverse().find(msg => msg.ideaCards?.selectable && !msg.ideaCards.submitted) || null,
    [messages]
  );

  const activeSelectionMessage = useMemo(
    () => [...messages].reverse().find(msg => msg.selectionCard && !msg.selectionCard.submitted) || null,
    [messages]
  );

  const canUseInput = !activeSelectionMessage && !activeIdeaSelectionMessage && !isLoading;

  const inputPlaceholder = (() => {
    if (activeSelectionMessage?.selectionCard?.kind === 'directions') {
      return 'Choose 1-3 directions below to continue...';
    }
    if (activeSelectionMessage?.selectionCard?.kind === 'actions') {
      return 'Choose one AI action below to continue...';
    }
    if (activeSelectionMessage?.selectionCard?.kind === 'entry-state') {
      return 'Choose the option that fits you best...';
    }
    if (activeIdeaSelectionMessage?.ideaCards?.selectable) {
      return 'Choose one project direction below to continue...';
    }
    if (brainstormSession?.awaitingChallengeAnswer) {
      return 'Answer the question above...';
    }
    if (brainstormSession?.stage === 'seed') {
      if (brainstormSession.currentQuestion === 'idea-description') {
        return 'Describe the idea you want to make real...';
      }
      if (brainstormSession.currentQuestion === 'project-description') {
        return 'Describe the project you want to improve...';
      }
      return 'Type your answer...';
    }
    if (brainstormSession?.stage === 'realize') {
      return 'Ask a follow-up about this project idea...';
    }
    return 'Ask about your components or describe a project idea...';
  })();

  const getPageTitle = () => {
    if (state?.detected && state.detected.length > 0) {
      return 'Component Scanner';
    }
    if (state?.initialMessage) {
      const maxLength = 40;
      const msg = state.initialMessage;
      return msg.length > maxLength ? `${msg.substring(0, maxLength)}...` : msg;
    }
    return 'AI Assistant';
  };

  const circuitState = useMemo(() => buildBrainstormCircuitState(state?.detected), [state?.detected]);

  const createBrainstormSession = (
    source: 'home' | 'scanner',
    knownComponents: string[],
    pendingInitialInput: string | null
  ): BrainstormSession => ({
    source,
    entryMode: null,
    stage: 'seed',
    currentQuestion: null,
    answers: {
      ...(knownComponents.length > 0 ? { question2: formatKnownComponentsAnswer(knownComponents) } : {}),
    },
    knownComponents,
    directions: [],
    selectedDirectionIds: [],
    selectedActionId: null,
    lastAmplifyResult: null,
    amplifyIdeas: [],
    selectedIdeaId: null,
    askedSeedFollowUp: false,
    pendingInitialInput,
    challengeQuestions: [],
    challengeAnswers: [],
    challengeQuestionIndex: 0,
    awaitingChallengeAnswer: false,
  });

  const initializeBrainstormFromHome = (initialMessage: string) => {
    const knownComponents = extractKnownComponents(state?.detected, initialMessage);

    setBrainstormSession(createBrainstormSession('home', knownComponents, initialMessage));

    setMessages([
      {
        id: createId('user'),
        role: 'user',
        content: initialMessage,
      },
      {
        id: createId('assistant'),
        role: 'assistant',
        content: 'Before we dive in, which of these feels closest to where you are right now?',
        selectionCard: buildEntryStateSelectionCard(),
      },
    ]);
  };

  const initializeBrainstormFromScanner = () => {
    const knownComponents = extractKnownComponents(state?.detected);
    setBrainstormSession(createBrainstormSession('scanner', knownComponents, null));

    setMessages(prev => [
      ...prev,
      {
        id: createId('assistant'),
        role: 'assistant',
        content: 'Before we dive in, which of these feels closest to where you are right now?',
        selectionCard: buildEntryStateSelectionCard(),
      },
    ]);
  };

  useEffect(() => {
    setMessages([]);
    setInput('');
    setChoiceMade(false);
    setSelectedChoice(null);
    setBrainstormSession(null);

    if (state?.initialMessage) {
      initializeBrainstormFromHome(state.initialMessage);
      return;
    }

    if (!state?.detected || state.detected.length === 0) {
      setMessages([
        {
          id: createId('assistant'),
          role: 'assistant',
          content: 'Start with a feeling, a problem, or a component you want to explore.',
        },
      ]);
      return;
    }

    setMessages([
      {
        id: 'scan-tags',
        role: 'assistant',
        componentTags: state.detected,
      },
      {
        id: 'scan-choice',
        role: 'assistant',
        content: `I found ${state.detected.length} component${state.detected.length === 1 ? '' : 's'}! What would you like to do with them?`,
        choiceQuestion: {
          question: 'Choose your goal:',
          options: [
            {
              id: 'learning',
              label: 'Learning',
              description: 'Follow a guided project tutorial',
              icon: 'learning',
            },
            {
              id: 'exploring',
              label: 'Exploring',
              description: 'Brainstorm project ideas with structured AI help',
              icon: 'exploring',
            },
          ],
        },
      },
    ]);
  }, [location.key]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const requestDirections = async (session: BrainstormSession) => {
    if (!isAIServiceConfigured()) {
      const fallback = buildDirectionsFallback(session);
      setBrainstormSession(prev => prev ? { ...prev, stage: 'play', currentQuestion: null, directions: fallback.directions } : prev);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: fallback.intro,
          selectionCard: {
            kind: 'directions',
            title: 'Which directions feel worth exploring a bit more?',
            subtitle: 'Pick up to 3.',
            options: fallback.directions.map(direction => ({
              id: direction.id,
              label: direction.title,
              description: direction.description,
              meta: direction.lens,
            })),
            multiSelect: true,
            maxSelections: 3,
            selectedIds: [],
            confirmLabel: 'Continue',
            columns: 2,
            helperText: 'Pick up to 3. More than that usually makes the next step too shallow.',
          },
        },
      ]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await sendMessage(buildDirectionsPrompt(session), [], circuitState);
      const parsed = parseAIResponse(response.content);
      const payload = extractJsonPayload(parsed.content) as {
        intro?: string;
        directions?: BrainstormDirection[];
      };
      const directions = (payload.directions || []).map((direction, index) => ({
        id: direction.id || PLAY_LENSES[index]?.id || `direction-${index + 1}`,
        lens: direction.lens || PLAY_LENSES[index]?.label || 'Direction',
        title: direction.title,
        description: direction.description,
      })).slice(0, 8);

      const safeDirections = directions.length === 8 ? directions : buildDirectionsFallback(session).directions;
      const intro = payload.intro || buildDirectionsFallback(session).intro;

      setBrainstormSession(prev => prev ? { ...prev, stage: 'play', currentQuestion: null, directions: safeDirections } : prev);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: intro,
          selectionCard: {
            kind: 'directions',
            title: 'Which directions feel worth exploring a bit more?',
            subtitle: 'Pick up to 3.',
            options: safeDirections.map(direction => ({
              id: direction.id,
              label: direction.title,
              description: direction.description,
              meta: direction.lens,
            })),
            multiSelect: true,
            maxSelections: 3,
            selectedIds: [],
            confirmLabel: 'Continue',
            columns: 2,
            helperText: 'Pick up to 3. More than that usually makes the next step too shallow.',
          },
        },
      ]);
    } catch (error) {
      console.error('Brainstorm directions error:', error);
      const fallback = buildDirectionsFallback(session);
      setBrainstormSession(prev => prev ? { ...prev, stage: 'play', currentQuestion: null, directions: fallback.directions } : prev);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: fallback.intro,
          selectionCard: {
            kind: 'directions',
            title: 'Which directions feel worth exploring a bit more?',
            subtitle: 'Pick up to 3.',
            options: fallback.directions.map(direction => ({
              id: direction.id,
              label: direction.title,
              description: direction.description,
              meta: direction.lens,
            })),
            multiSelect: true,
            maxSelections: 3,
            selectedIds: [],
            confirmLabel: 'Continue',
            columns: 2,
            helperText: 'Pick up to 3. More than that usually makes the next step too shallow.',
          },
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const requestRealizeStage = async (session: BrainstormSession, selectedIdea: BrainstormIdea) => {
    try {
      const response = await sendMessage(buildRealizePrompt(session, selectedIdea), [], circuitState);
      const parsed = parseAIResponse(response.content);
      const payload = extractJsonPayload(parsed.content) as {
        intro?: string;
        project?: Partial<FinalProjectData>;
        breakdown?: RealizeResult['breakdown'];
        twist?: string;
      };

      const fallback = buildRealizeFallback(session, { intro: '', ideas: [selectedIdea] });
      const project = payload.project
        ? {
            title: cleanInlineMarkdown(payload.project.title || fallback.project.title),
            difficulty: normalizeDifficulty(payload.project.difficulty),
            hook: cleanInlineMarkdown(payload.project.hook || fallback.project.hook),
            whatItDoes: cleanInlineMarkdown(payload.project.whatItDoes || fallback.project.whatItDoes),
            components: normalizeComponentNeeds(payload.project.components).length > 0
              ? normalizeComponentNeeds(payload.project.components)
              : fallback.project.components,
            summary: cleanInlineMarkdown(payload.project.summary || fallback.project.summary),
          }
        : fallback.project;

      const difficulty = normalizeDifficulty(project.difficulty);
      const normalizedBreakdown = difficulty === 'easy'
        ? null
        : payload.breakdown && Array.isArray(payload.breakdown.steps) && payload.breakdown.steps.length > 0
          ? {
              title: payload.breakdown.title || 'Project breakdown',
              steps: payload.breakdown.steps.slice(0, 4),
              note: payload.breakdown.note || 'Keep the path short enough that the project still feels buildable.',
            }
          : fallback.breakdown;

      setBrainstormSession(prev => prev ? { ...prev, stage: 'realize' } : prev);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: payload.intro || fallback.intro,
          finalProject: {
            title: project.title,
            difficulty,
            hook: project.hook,
            whatItDoes: project.whatItDoes,
            components: project.components,
            summary: project.summary,
          },
          breakdownCard: normalizedBreakdown || undefined,
          twistCallout: {
            title: 'Have more fun',
            content: cleanInlineMarkdown(payload.twist || fallback.twist || ''),
          },
          actionButtons: {
            buttons: [
              { id: 'start-project', label: "Sounds good, let's start project" },
              { id: 'restart', label: 'Start over' },
            ],
          },
        },
      ]);
    } catch (error) {
      console.error('Brainstorm realize error:', error);
      const fallback = buildRealizeFallback(session, { intro: '', ideas: [selectedIdea] });
      setBrainstormSession(prev => prev ? { ...prev, stage: 'realize' } : prev);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: fallback.intro,
          finalProject: fallback.project,
          breakdownCard: fallback.breakdown || undefined,
          twistCallout: {
            title: 'Have more fun',
            content: fallback.twist || '',
          },
          actionButtons: {
            buttons: [
              { id: 'start-project', label: "Sounds good, let's start project" },
              { id: 'restart', label: 'Start over' },
            ],
          },
        },
      ]);
    }
  };

  const requestAmplifyStage = async (session: BrainstormSession) => {
    if (!session.selectedActionId) return;

    setIsLoading(true);
    try {
      if (session.selectedActionId === 'challenge') {
        let challengePlan: ChallengePlan;
        if (!isAIServiceConfigured()) {
          challengePlan = {
            intro: 'I’m going to ask a few sharp questions, one at a time, so we can understand what would make this idea genuinely interesting.',
            questions: [
              'Who is this project really for, and what should they feel when it starts responding?',
              'If you removed one obvious feature, what would still make the project worth building?',
              'What is the most important tension here: surprise, comfort, visibility, privacy, play, or something else?',
            ],
          };
        } else {
          const response = await sendMessage(buildChallengeQuestionsPrompt(session), [], circuitState);
          const parsed = parseAIResponse(response.content);
          const payload = extractJsonPayload(parsed.content) as { intro?: string; questions?: string[] };
          challengePlan = {
            intro: cleanInlineMarkdown(payload.intro || 'I’m going to ask a few sharp questions, one at a time, so we can understand what would make this idea genuinely interesting.'),
            questions: Array.isArray(payload.questions) && payload.questions.length > 0
              ? payload.questions.slice(0, 3).map(question => cleanInlineMarkdown(question))
              : [
                  'Who is this project really for, and what should they feel when it starts responding?',
                  'If you removed one obvious feature, what would still make the project worth building?',
                  'What is the most important tension here: surprise, comfort, visibility, privacy, play, or something else?',
                ],
          };
        }

        setBrainstormSession(prev => prev ? {
          ...prev,
          stage: 'amplify',
          challengeQuestions: challengePlan.questions,
          challengeAnswers: [],
          challengeQuestionIndex: 0,
          awaitingChallengeAnswer: true,
          lastAmplifyResult: null,
          amplifyIdeas: [],
          selectedIdeaId: null,
        } : prev);
        setMessages(prev => [
          ...prev,
          {
            id: createId('assistant'),
            role: 'assistant',
            content: `${challengePlan.intro}\n\n${challengePlan.questions[0]}`,
          },
        ]);
        return;
      }

      let amplify: AmplifyResult;
      if (!isAIServiceConfigured()) {
        amplify = buildAmplifyFallback(session);
      } else {
        const response = await sendMessage(buildAmplifyPrompt(session), [], circuitState);
        const parsed = parseAIResponse(response.content);
        const payload = extractJsonPayload(parsed.content) as {
          intro?: string;
          ideas?: Partial<BrainstormIdea>[];
          helperText?: string;
          breakdown?: BreakdownCardData | null;
        };
        const fallback = buildAmplifyFallback(session);
        amplify = {
          intro: cleanInlineMarkdown(payload.intro || fallback.intro),
          ideas: Array.isArray(payload.ideas) && payload.ideas.length > 0
            ? payload.ideas.slice(0, 4).map((idea, index) => normalizeIdea(idea, `amplify-${index + 1}`))
            : fallback.ideas,
          helperText: cleanInlineMarkdown(payload.helperText || fallback.helperText || ''),
          breakdown: payload.breakdown && Array.isArray(payload.breakdown.steps)
            ? {
                title: payload.breakdown.title || 'A simple build path',
                steps: payload.breakdown.steps.slice(0, 4).map(step => cleanInlineMarkdown(step)),
                note: cleanInlineMarkdown(payload.breakdown.note || ''),
              }
            : fallback.breakdown,
        };
      }

      setBrainstormSession(prev => prev ? {
        ...prev,
        stage: 'amplify',
        lastAmplifyResult: amplify,
        amplifyIdeas: amplify.ideas,
        selectedIdeaId: null,
        challengeQuestions: [],
        challengeAnswers: [],
        challengeQuestionIndex: 0,
        awaitingChallengeAnswer: false,
      } : prev);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: amplify.intro,
          ideaCards: {
            title: session.selectedActionId === 'decompose'
              ? 'Here is a buildable version with a clearer path.'
              : 'Here are a few stronger directions to choose from.',
            ideas: amplify.ideas,
            selectable: true,
            selectedId: null,
            confirmLabel: 'Continue',
            helperText: amplify.helperText,
          },
          breakdownCard: amplify.breakdown || undefined,
        },
      ]);
    } catch (error) {
      console.error('Brainstorm amplify error:', error);
      const fallback = buildAmplifyFallback(session);
      setBrainstormSession(prev => prev ? {
        ...prev,
        stage: 'amplify',
        lastAmplifyResult: fallback,
        amplifyIdeas: fallback.ideas,
        selectedIdeaId: null,
        challengeQuestions: [],
        challengeAnswers: [],
        challengeQuestionIndex: 0,
        awaitingChallengeAnswer: false,
      } : prev);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: fallback.intro,
          ideaCards: {
            title: session.selectedActionId === 'decompose'
              ? 'Here is a buildable version with a clearer path.'
              : 'Here are a few stronger directions to choose from.',
            ideas: fallback.ideas,
            selectable: true,
            selectedId: null,
            confirmLabel: 'Continue',
            helperText: fallback.helperText,
          },
          breakdownCard: fallback.breakdown || undefined,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChallengeAnswer = async (text: string) => {
    if (!brainstormSession || !brainstormSession.awaitingChallengeAnswer) return;

    const nextAnswers = [...brainstormSession.challengeAnswers, text];
    const nextIndex = brainstormSession.challengeQuestionIndex + 1;

    setMessages(prev => [
      ...prev,
      { id: createId('user'), role: 'user', content: text },
    ]);

    if (nextIndex < brainstormSession.challengeQuestions.length) {
      setBrainstormSession({
        ...brainstormSession,
        challengeAnswers: nextAnswers,
        challengeQuestionIndex: nextIndex,
        awaitingChallengeAnswer: true,
      });
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: brainstormSession.challengeQuestions[nextIndex],
        },
      ]);
      return;
    }

    const completedSession: BrainstormSession = {
      ...brainstormSession,
      challengeAnswers: nextAnswers,
      challengeQuestionIndex: nextIndex,
      awaitingChallengeAnswer: false,
    };
    setBrainstormSession(completedSession);

    setIsLoading(true);
    try {
      let result: AmplifyResult;
      if (!isAIServiceConfigured()) {
        const fallback = buildAmplifyFallback({ ...completedSession, selectedActionId: 'expand' });
        result = {
          ...fallback,
          intro: 'Now I have a clearer sense of what matters to you. Here are a few more focused directions that grow from your answers.',
        };
      } else {
        const response = await sendMessage(buildChallengeSynthesisPrompt(completedSession), [], circuitState);
        const parsed = parseAIResponse(response.content);
        const payload = extractJsonPayload(parsed.content) as {
          intro?: string;
          ideas?: Partial<BrainstormIdea>[];
          helperText?: string;
        };
        const fallback = buildAmplifyFallback({ ...completedSession, selectedActionId: 'expand' });
        result = {
          intro: cleanInlineMarkdown(payload.intro || 'Now I have a clearer sense of what matters to you. Here are a few more focused directions that grow from your answers.'),
          ideas: Array.isArray(payload.ideas) && payload.ideas.length > 0
            ? payload.ideas.slice(0, 3).map((idea, index) => normalizeIdea(idea, `challenge-result-${index + 1}`))
            : fallback.ideas,
          helperText: cleanInlineMarkdown(payload.helperText || fallback.helperText || ''),
        };
      }

      setBrainstormSession(prev => prev ? {
        ...prev,
        lastAmplifyResult: result,
        amplifyIdeas: result.ideas,
        selectedIdeaId: null,
        awaitingChallengeAnswer: false,
      } : prev);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: result.intro,
          ideaCards: {
            title: 'Now the direction feels clearer.',
            ideas: result.ideas,
            selectable: true,
            selectedId: null,
            confirmLabel: 'Continue',
            helperText: result.helperText,
          },
        },
      ]);
    } catch (error) {
      console.error('Challenge synthesis error:', error);
      const fallback = buildAmplifyFallback({ ...completedSession, selectedActionId: 'expand' });
      setBrainstormSession(prev => prev ? {
        ...prev,
        lastAmplifyResult: fallback,
        amplifyIdeas: fallback.ideas,
        selectedIdeaId: null,
        awaitingChallengeAnswer: false,
      } : prev);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: 'Now I have a clearer sense of what matters to you. Here are a few more focused directions that grow from your answers.',
          ideaCards: {
            title: 'Now the direction feels clearer.',
            ideas: fallback.ideas,
            selectable: true,
            selectedId: null,
            confirmLabel: 'Continue',
            helperText: fallback.helperText,
          },
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedAnswer = async (text: string) => {
    if (!brainstormSession || !brainstormSession.currentQuestion) return;

    const questionId = brainstormSession.currentQuestion;
    const history = buildConversationHistory(messages);
    const pendingInitial = brainstormSession.pendingInitialInput?.trim();
    const nextAnswers = questionId === 'question1-followup'
      ? {
          ...brainstormSession.answers,
          question1: [brainstormSession.answers.question1, text].filter(Boolean).join(' | '),
        }
      : questionId === 'idea-description' || questionId === 'project-description'
        ? {
            ...brainstormSession.answers,
            question1: pendingInitial && pendingInitial.toLowerCase() !== text.trim().toLowerCase()
              ? `${pendingInitial} | ${text}`
              : text,
          }
      : { ...brainstormSession.answers, [questionId]: text };
    let nextKnownComponents = brainstormSession.knownComponents;

    if (questionId === 'question1' || questionId === 'question2' || questionId === 'question1-followup') {
      nextKnownComponents = uniqueStrings([...nextKnownComponents, ...detectMentionedComponents(text)]);
    }

    setMessages(prev => [
      ...prev,
      { id: createId('user'), role: 'user', content: text },
    ]);

    if (questionId === 'idea-description' || questionId === 'project-description') {
      const completedSession: BrainstormSession = {
        ...brainstormSession,
        stage: 'play',
        currentQuestion: null,
        answers: nextAnswers,
        knownComponents: nextKnownComponents,
        pendingInitialInput: null,
      };
      setBrainstormSession(completedSession);
      await requestDirections(completedSession);
      return;
    }

    if (questionId === 'question1' && !brainstormSession.askedSeedFollowUp) {
      let followUpContent = `That's a strong starting point. What's one small moment, image, or sensation that captures it for you?`;

      if (isAIServiceConfigured()) {
        setIsLoading(true);
        try {
          const response = await sendMessage(text, [], circuitState, undefined, history);
          const parsed = parseAIResponse(response.content);
          followUpContent = parsed.content;
        } catch (error) {
          console.error('Brainstorm seed follow-up error:', error);
        } finally {
          setIsLoading(false);
        }
      }

      setBrainstormSession({
        ...brainstormSession,
        answers: nextAnswers,
        knownComponents: nextKnownComponents,
        currentQuestion: 'question1-followup',
        askedSeedFollowUp: true,
        pendingInitialInput: null,
      });
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: followUpContent,
        },
      ]);
      return;
    }

    if (questionId === 'question1' || questionId === 'question1-followup') {
      const hasComponentsAlready = nextKnownComponents.length > 0;
      const nextQuestion = hasComponentsAlready ? 'question3' : 'question2';
      const nextSession: BrainstormSession = {
        ...brainstormSession,
        answers: {
          ...nextAnswers,
          ...(hasComponentsAlready && !nextAnswers.question2 ? { question2: formatKnownComponentsAnswer(nextKnownComponents) } : {}),
        },
        knownComponents: nextKnownComponents,
        currentQuestion: nextQuestion,
        pendingInitialInput: null,
      };
      setBrainstormSession(nextSession);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: hasComponentsAlready
            ? 'That gives me something real to work with. If you had one afternoon, what would you most want to make something able to do? If you do not have a clear answer yet, that is totally okay — I can explore it with you.'
            : 'That helps. What Arduino parts or modules do you already have nearby, or most want to use for this idea?',
        },
      ]);
      return;
    }

    if (questionId === 'question2') {
      const nextSession: BrainstormSession = {
        ...brainstormSession,
        answers: nextAnswers,
        knownComponents: nextKnownComponents,
        currentQuestion: 'question3',
        pendingInitialInput: null,
      };
      setBrainstormSession(nextSession);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: 'Nice. If you had one afternoon, what would you most want to make something able to do? If you do not have a clear answer yet, that is totally okay — I can explore it with you.',
        },
      ]);
      return;
    }

    const completedSession: BrainstormSession = {
      ...brainstormSession,
      stage: 'play',
      currentQuestion: null,
      answers: nextAnswers,
      knownComponents: nextKnownComponents,
      pendingInitialInput: null,
    };
    setBrainstormSession(completedSession);
    await requestDirections(completedSession);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading || activeSelectionMessage || activeIdeaSelectionMessage) return;
    setInput('');

    if (brainstormSession?.awaitingChallengeAnswer) {
      await handleChallengeAnswer(text);
      return;
    }

    if (brainstormSession?.stage === 'seed' && brainstormSession.currentQuestion) {
      await handleSeedAnswer(text);
      return;
    }

    const history = buildConversationHistory(messages);
    setMessages(prev => [
      ...prev,
      { id: createId('user'), role: 'user', content: text },
    ]);

    if (!isAIServiceConfigured()) {
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: "I'm still learning! For now, try clicking on one of the recommended projects above to get started with a guided tutorial.",
        },
      ]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await sendMessage(text, [], circuitState, undefined, history);
      const parsed = parseAIResponse(response.content);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: parsed.content,
        },
      ]);
    } catch (error) {
      console.error('AI service error:', error);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: 'Sorry, I had trouble processing that. Please try again in a moment.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const isConnectionMessage = (content: string): boolean => {
    const lower = content.toLowerCase();
    const strongTriggers = [
      '开始搭建', '开始构建', '开始组装', '开始接线', '开始连接',
      '让我们开始', '我们开始搭', '首先需要放置', '首先放置',
      '开始这个项目', '开始项目',
      'start building', "let's start", "let's build", 'begin building',
      'begin wiring', "let's get started", 'start with the',
    ];
    if (strongTriggers.some(keyword => lower.includes(keyword.toLowerCase()))) return true;

    const keywords = [
      'connect', 'wire', 'gnd', '5v', 'resistor', 'pin', 'breadboard',
      'step 1', 'step 2', 'step1', 'step2',
      '连接', '接线', '面包板', '电阻', '引脚', '步骤',
      '放置组件', '插入', '第一步', '第二步',
    ];
    return keywords.filter(keyword => lower.includes(keyword) || content.includes(keyword)).length >= 2;
  };

  const startProjectMsgId = (() => {
    if (messages.length < 2) return null;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const msg = messages[index];
      if (msg.ideaCards || msg.selectionCard || msg.finalProject || msg.actionButtons) continue;
      if (msg.role === 'assistant' && msg.content && isConnectionMessage(msg.content)) {
        return msg.id;
      }
    }
    return null;
  })();

  const lastAssistantMsgId = (() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === 'assistant') return messages[index].id;
    }
    return null;
  })();

  const handleStartProject = (message?: ChatMessage) => {
    if (!message?.finalProject) {
      navigate('/project/led-button');
      return;
    }

    const startConfig = buildStartProjectConfig(message);
    navigate('/project/ai-session', {
      state: {
        fromAIChat: true,
        ...startConfig,
      },
    });
  };

  const handleProjectClick = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  const handleRestartBrainstorm = () => {
    const source = brainstormSession?.source || (state?.detected?.length ? 'scanner' : 'home');
    const knownComponents = brainstormSession?.knownComponents?.length
      ? brainstormSession.knownComponents
      : extractKnownComponents(state?.detected);

    setBrainstormSession(createBrainstormSession(source, knownComponents, null));
    setInput('');
    setIsLoading(false);
    setMessages(prev => [
      ...prev,
      {
        id: createId('assistant'),
        role: 'assistant',
        content: "OK, let's brainstorm again. Which of these feels closest to where you are right now?",
        selectionCard: buildEntryStateSelectionCard(),
      },
    ]);
  };

  const updateSelectionCard = (messageId: string, updater: (card: SelectionCardData) => SelectionCardData) => {
    setMessages(prev => prev.map(msg => (
      msg.id === messageId && msg.selectionCard
        ? { ...msg, selectionCard: updater(msg.selectionCard) }
        : msg
    )));
  };

  const updateIdeaCards = (messageId: string, updater: (cards: IdeaCardsData) => IdeaCardsData) => {
    setMessages(prev => prev.map(msg => (
      msg.id === messageId && msg.ideaCards
        ? { ...msg, ideaCards: updater(msg.ideaCards) }
        : msg
    )));
  };

  const handleSelectionToggle = (messageId: string, optionId: string) => {
    const message = messages.find(msg => msg.id === messageId);
    const card = message?.selectionCard;
    if (!card || card.submitted) return;
    const targetOption = card.options.find(option => option.id === optionId);
    if (targetOption?.disabled) return;

    updateSelectionCard(messageId, current => {
      const isSelected = current.selectedIds.includes(optionId);
      if (current.multiSelect) {
        if (isSelected) {
          return { ...current, selectedIds: current.selectedIds.filter(id => id !== optionId) };
        }
        if (current.selectedIds.length >= current.maxSelections) {
          return { ...current, selectedIds: [...current.selectedIds.slice(1), optionId] };
        }
        return { ...current, selectedIds: [...current.selectedIds, optionId] };
      }
      return { ...current, selectedIds: isSelected ? [] : [optionId] };
    });
  };

  const handleSelectionConfirm = async (messageId: string) => {
    const message = messages.find(msg => msg.id === messageId);
    const card = message?.selectionCard;
    if (!card || card.submitted || card.selectedIds.length === 0) return;

    updateSelectionCard(messageId, current => ({ ...current, submitted: true }));

    if (card.kind === 'entry-state' && brainstormSession) {
      const selectedMode = card.selectedIds[0] as EntryModeId;
      const selectedLabel = ENTRY_MODE_OPTIONS.find(option => option.id === selectedMode)?.label || 'This sounds closest';
      const knownComponentsText = brainstormSession.knownComponents.join(', ');
      const pendingInput = brainstormSession.pendingInitialInput?.trim();
      const hasMeaningfulInitialInput = !!pendingInput && pendingInput.length > 2;

      setMessages(prev => [
        ...prev,
        {
          id: createId('user'),
          role: 'user',
          content: selectedLabel,
        },
      ]);

      if (selectedMode === 'many-ideas') {
        setBrainstormSession({
          ...brainstormSession,
          entryMode: selectedMode,
          currentQuestion: 'idea-description',
          answers: {
            ...brainstormSession.answers,
            ...(brainstormSession.knownComponents.length > 0 ? { question2: formatKnownComponentsAnswer(brainstormSession.knownComponents) } : {}),
          },
        });
        setMessages(prev => [
          ...prev,
          {
            id: createId('assistant'),
            role: 'assistant',
            content: hasMeaningfulInitialInput
              ? `Got it. You already mentioned **${cleanInlineMarkdown(pendingInput || '')}**. Tell me a bit more about the idea you most want to make real right now, and what feels unclear or hard about building it.`
              : 'Tell me about the idea you most want to make real right now. What is it, and what feels unclear or hard about building it?',
          },
        ]);
        return;
      }

      if (selectedMode === 'optimize-existing') {
        setBrainstormSession({
          ...brainstormSession,
          entryMode: selectedMode,
          currentQuestion: 'project-description',
          answers: {
            ...brainstormSession.answers,
            ...(brainstormSession.knownComponents.length > 0 ? { question2: formatKnownComponentsAnswer(brainstormSession.knownComponents) } : {}),
          },
        });
        setMessages(prev => [
          ...prev,
          {
            id: createId('assistant'),
            role: 'assistant',
            content: hasMeaningfulInitialInput
              ? `Got it. You already mentioned **${cleanInlineMarkdown(pendingInput || '')}**. Tell me about the project you made before and what you want to improve, expand, or make more interesting.`
              : 'Tell me about the project you made before and what you want to improve, expand, or make more interesting.',
          },
        ]);
        return;
      }

      const guidedSession: BrainstormSession = {
        ...brainstormSession,
        entryMode: selectedMode,
        currentQuestion: 'question1',
        answers: {
          ...(brainstormSession.knownComponents.length > 0 ? { question2: formatKnownComponentsAnswer(brainstormSession.knownComponents) } : {}),
        },
        askedSeedFollowUp: false,
      };
      setBrainstormSession(guidedSession);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: knownComponentsText
            ? `I see you've got **${knownComponentsText.toLowerCase()}** — that's a fascinating place to start. What kind of **feeling or theme** are you drawn to exploring? Maybe something about presence and absence, personal space, or something that responds to movement?`
            : 'What kind of **feeling or theme** interests you? If you do not have a clear idea yet, that is totally okay — I can explore it with you.',
        },
      ]);
      return;
    }

    if (card.kind === 'directions' && brainstormSession) {
      const selectedDirections = brainstormSession.directions.filter(direction => card.selectedIds.includes(direction.id));
      setMessages(prev => [
        ...prev,
        {
          id: createId('user'),
          role: 'user',
          content: `I want to explore **${selectedDirections.map(direction => direction.title).join(', ')}**.`,
        },
        {
          id: createId('assistant'),
          role: 'assistant',
          content: 'Great. Now choose how you want AI to help with those directions.',
          selectionCard: {
            kind: 'actions',
            title: 'How should I help with these directions?',
            subtitle: 'Choose one action.',
            options: AMPLIFY_ACTIONS.map(action => ({
              id: action.id,
              label: action.title,
              description: action.description,
              disabled: action.id === 'combine' && selectedDirections.length < 2,
            })),
            multiSelect: false,
            maxSelections: 1,
            selectedIds: [],
            confirmLabel: 'Continue',
            columns: 1,
            helperText: 'One action at a time keeps the direction clear.',
          },
        },
      ]);

      setBrainstormSession(prev => prev ? {
        ...prev,
        stage: 'amplify',
        selectedDirectionIds: card.selectedIds,
      } : prev);
      return;
    }

    if (card.kind === 'actions' && brainstormSession) {
      const selectedAction = AMPLIFY_ACTIONS.find(action => action.id === card.selectedIds[0]);
      setMessages(prev => [
        ...prev,
        {
          id: createId('user'),
          role: 'user',
          content: `Please **${selectedAction?.title || 'continue'}** with these directions.`,
        },
      ]);

      const nextSession: BrainstormSession = {
        ...brainstormSession,
        stage: 'amplify',
        selectedActionId: card.selectedIds[0] as AmplifyActionId,
      };
      setBrainstormSession(nextSession);
      await requestAmplifyStage(nextSession);
    }
  };

  const handleIdeaToggle = (messageId: string, ideaId: string) => {
    const message = messages.find(msg => msg.id === messageId);
    const cards = message?.ideaCards;
    if (!cards || cards.submitted || !cards.selectable) return;

    updateIdeaCards(messageId, current => ({
      ...current,
      selectedId: current.selectedId === ideaId ? null : ideaId,
    }));
  };

  const handleIdeaConfirm = async (messageId: string) => {
    const message = messages.find(msg => msg.id === messageId);
    const cards = message?.ideaCards;
    if (!cards || cards.submitted || !cards.selectable || !cards.selectedId || !brainstormSession) return;

    updateIdeaCards(messageId, current => ({ ...current, submitted: true }));
    const selectedIdea = brainstormSession.amplifyIdeas.find(idea => idea.id === cards.selectedId);
    if (!selectedIdea) return;

    setMessages(prev => [
      ...prev,
      {
        id: createId('user'),
        role: 'user',
        content: `Let's continue with **${selectedIdea.title}**.`,
      },
    ]);

    const nextSession: BrainstormSession = {
      ...brainstormSession,
      selectedIdeaId: selectedIdea.id,
    };
    setBrainstormSession(nextSession);
    setIsLoading(true);
    try {
      await requestRealizeStage(nextSession, selectedIdea);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionButton = (actionId: 'start-project' | 'restart', message: ChatMessage) => {
    if (actionId === 'start-project') {
      handleStartProject(message);
      return;
    }
    handleRestartBrainstorm();
  };

  const handleGoalChoice = async (choiceId: string) => {
    if (choiceMade || selectedChoice) return;
    setSelectedChoice(choiceId);
    await new Promise(resolve => setTimeout(resolve, 400));
    setChoiceMade(true);

    const choiceLabel = choiceId === 'learning' ? 'Learning' : 'Exploring';
    const userChoiceMsg: ChatMessage = {
      id: createId('user-choice'),
      role: 'user',
      content: `I'd like to start **${choiceLabel}**!`,
    };
    setMessages(prev => [...prev, userChoiceMsg]);

    if (choiceId === 'learning') {
      const detected = state?.detected || [];
      const matches = matchProjects(detected, 0).slice(0, 3);
      const bestMatch = matches[0];
      const bestMatchIntro = bestMatch
        ? `**${bestMatch.project.title}** is your best match at ${bestMatch.matchPercent}%! ${bestMatch.project.description}`
        : 'Check out these projects to get started!';

      setMessages(prev => [
        ...prev,
        {
          id: createId('projects'),
          role: 'assistant',
          content: 'Great choice! Here are some featured projects that match your components:',
          projectCards: { matches, bestMatchIntro },
        },
      ]);
      return;
    }

    initializeBrainstormFromScanner();
    if (isAIServiceConfigured()) {
      setIsLoading(true);
      try {
        const detected = state?.detected || [];
        const componentNames = detected.map(d => d.className).join(', ');
        const exploringPrompt = `The user has these components: ${componentNames}. They chose "Exploring" mode — they want to brainstorm and discover creative project ideas. Start by asking them about what feelings, themes or ideas they'd like to explore. Be conversational and encouraging. Keep it brief. Mention the component naturally first, then ask the feeling question with a little guidance.`;
        const response = await sendMessage(exploringPrompt, [], circuitState);
        const parsed = parseAIResponse(response.content);
        setMessages(prev => {
          const next = [...prev];
          const lastAssistantIndex = next.map(item => item.role).lastIndexOf('assistant');
          if (lastAssistantIndex >= 0) {
            next[lastAssistantIndex] = { ...next[lastAssistantIndex], content: parsed.content };
          }
          return next;
        });
      } catch (error) {
        console.error('Exploring intro error:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="home-page">
      <div className="home-shell">
        <Sidebar />

        <main className="scan-chat-main">
          <div className="scan-chat-header">
            <div className="scan-chat-header-icon blue-character-static">
              <BlueCharacter
                x={18}
                y={18}
                visible={true}
                mood="happy"
                size="small"
              />
            </div>
            <h1>{getPageTitle()}</h1>
          </div>

          <div className="scan-chat-messages">
            {messages.map(msg => (
              <div key={msg.id}>
                <div className={`scan-chat-msg scan-chat-msg--${msg.role}`}>
                  {msg.role === 'assistant' && (
                    <div className={`scan-chat-avatar scan-chat-avatar--character ${msg.id !== lastAssistantMsgId ? 'blue-character-static' : ''}`}>
                      <BlueCharacter
                        x={16}
                        y={16}
                        visible={true}
                        mood="happy"
                        size="small"
                      />
                    </div>
                  )}
                  <div className="scan-chat-bubble">
                    {msg.componentTags && (
                      <div className="scan-tags-only">
                        <div className="scan-results-section-title">
                          <Package size={16} />
                          Components Found ({msg.componentTags.length})
                        </div>
                        <div className="scan-results-tags">
                          {msg.componentTags.map(d => (
                            <span key={d.className} className={`scanner-tag ${getChipClass(d.className)}`}>
                              {d.className}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.content && (
                      <div className="scan-chat-text">
                        {parseMarkdown(
                          msg.role === 'assistant' ? stripComponentRefs(msg.content) : msg.content
                        )}
                      </div>
                    )}

                    {msg.choiceQuestion && !choiceMade && (
                      <div className="goal-choice-list">
                        {msg.choiceQuestion.options.map(opt => (
                          <button
                            key={opt.id}
                            className={`goal-choice-row ${selectedChoice === opt.id ? 'selected' : ''}`}
                            onClick={() => handleGoalChoice(opt.id)}
                            disabled={!!selectedChoice && selectedChoice !== opt.id}
                            type="button"
                          >
                            <span className="goal-radio">
                              {selectedChoice === opt.id && <span className="goal-radio-dot" />}
                            </span>
                            <span className="goal-choice-text">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {msg.selectionCard && (
                      <div className={`brainstorm-selection-card ${msg.selectionCard.kind === 'actions' ? 'brainstorm-selection-card--actions' : ''}`}>
                        <div className="brainstorm-selection-header">
                          <div className="brainstorm-selection-title">{msg.selectionCard.title}</div>
                          <div className="brainstorm-selection-subtitle">{msg.selectionCard.subtitle}</div>
                        </div>

                        <div className={`brainstorm-selection-grid brainstorm-selection-grid--${msg.selectionCard.columns || 1} ${msg.selectionCard.kind === 'actions' ? 'brainstorm-selection-grid--actions' : ''}`}>
                          {msg.selectionCard.options.map(option => {
                            const isSelected = msg.selectionCard!.selectedIds.includes(option.id);
                            return (
                              <button
                                key={option.id}
                                type="button"
                                className={`brainstorm-option-card ${isSelected ? 'selected' : ''} ${msg.selectionCard?.kind === 'actions' ? 'brainstorm-option-card--action-row' : ''} ${option.disabled ? 'brainstorm-option-card--disabled' : ''}`}
                                onClick={() => handleSelectionToggle(msg.id, option.id)}
                                disabled={msg.selectionCard?.submitted || option.disabled}
                              >
                                {msg.selectionCard?.kind === 'actions' ? (
                                  <div className="brainstorm-action-row-content">
                                    <span className={`brainstorm-option-check ${isSelected ? 'selected' : ''}`}>
                                      {isSelected && <Check size={12} />}
                                    </span>
                                    <span className="brainstorm-action-row-text">
                                      <span className="brainstorm-option-label">{option.label}:</span>
                                      <span className="brainstorm-option-description">{option.description}</span>
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="brainstorm-option-top">
                                      {option.meta && <span className="brainstorm-option-meta">{option.meta}</span>}
                                      <span className={`brainstorm-option-check ${isSelected ? 'selected' : ''}`}>
                                        {isSelected && <Check size={12} />}
                                      </span>
                                    </div>
                                    <div className="brainstorm-option-label">{option.label}</div>
                                    <div className="brainstorm-option-description">{option.description}</div>
                                  </>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        <div className="brainstorm-selection-footer">
                          {msg.selectionCard.helperText && (
                            <div className="brainstorm-selection-helper">{msg.selectionCard.helperText}</div>
                          )}
                          <button
                            type="button"
                            className="brainstorm-confirm-btn"
                            onClick={() => handleSelectionConfirm(msg.id)}
                            disabled={msg.selectionCard.selectedIds.length === 0 || !!msg.selectionCard.submitted}
                          >
                            {msg.selectionCard.submitted ? 'Locked in' : msg.selectionCard.confirmLabel}
                          </button>
                        </div>
                      </div>
                    )}

                    {msg.projectCards && (
                      <div className="featured-projects-section">
                        <div className="featured-projects-grid">
                          {msg.projectCards.matches.map(m => {
                            const isComingSoon = m.project.steps.length === 0;
                            const isBestMatch = m === msg.projectCards!.matches[0];
                            return (
                              <button
                                key={m.project.id}
                                className={`featured-project-card ${isComingSoon ? 'coming-soon' : ''} ${isBestMatch ? 'best-match' : ''}`}
                                onClick={() => !isComingSoon && handleProjectClick(m.project.id)}
                                disabled={isComingSoon}
                                type="button"
                              >
                                {isBestMatch && <div className="best-match-badge">Best Match</div>}
                                <div className={`featured-project-icon ${getDifficultyColor(m.project.difficulty)}`}>
                                  <Cpu size={20} />
                                </div>
                                <h4 className="featured-project-title">{m.project.title}</h4>
                                <p className="featured-project-desc">{m.project.description}</p>
                                <div className="featured-project-match">
                                  <div className="match-bar">
                                    <div className="match-bar-fill" style={{ width: `${m.matchPercent}%` }} />
                                  </div>
                                  <span className="match-percent">{m.matchPercent}% match</span>
                                </div>
                                {!isComingSoon && (
                                  <div className="featured-project-action">
                                    <span>Start</span>
                                    <ChevronRight size={14} />
                                  </div>
                                )}
                                {isComingSoon && <span className="featured-project-soon">Coming Soon</span>}
                              </button>
                            );
                          })}
                        </div>
                        <div className="featured-projects-intro">
                          {parseMarkdown(msg.projectCards.bestMatchIntro)}
                        </div>
                      </div>
                    )}

                    {msg.ideaCards && (
                      <div className="brainstorm-idea-cards">
                        {msg.ideaCards.title && (
                          <div className="brainstorm-selection-title">{msg.ideaCards.title}</div>
                        )}
                        {msg.ideaCards.subtitle && (
                          <div className="brainstorm-selection-subtitle">{msg.ideaCards.subtitle}</div>
                        )}
                        <div className="brainstorm-idea-list">
                          {msg.ideaCards.ideas.map(idea => {
                            const isSelected = msg.ideaCards?.selectedId === idea.id;
                            return (
                              <button
                                key={idea.id}
                                type="button"
                                className={`brainstorm-idea-card ${isSelected ? 'selected' : ''} ${msg.ideaCards?.selectable ? 'brainstorm-idea-card--selectable' : ''}`}
                                onClick={() => msg.ideaCards?.selectable && handleIdeaToggle(msg.id, idea.id)}
                                disabled={!msg.ideaCards?.selectable || !!msg.ideaCards.submitted}
                              >
                                <div className="brainstorm-idea-header">
                                  <div className="brainstorm-idea-title-group">
                                    <div className="brainstorm-idea-title">{idea.title}</div>
                                    {idea.hook && <div className="brainstorm-idea-hook">{idea.hook}</div>}
                                  </div>
                                  <div className="brainstorm-idea-chip-row">
                                    <span className={`brainstorm-difficulty-chip ${getBrainstormDifficultyClass(idea.difficulty)}`}>
                                      {formatDifficultyLabel(idea.difficulty)}
                                    </span>
                                    {msg.ideaCards?.selectable && (
                                      <span className={`brainstorm-option-check ${isSelected ? 'selected' : ''}`}>
                                        {isSelected && <Check size={12} />}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="brainstorm-idea-section">
                                  <div className="brainstorm-idea-section-title">What it does</div>
                                  <p>{idea.whatItDoes}</p>
                                </div>
                                {idea.components.length > 0 && (
                                  <div className="brainstorm-idea-section">
                                    <div className="brainstorm-idea-section-title">Components needed</div>
                                    <div className="brainstorm-component-list">
                                      {idea.components.map(component => (
                                        <div key={`${idea.id}-${component.name}`} className="brainstorm-component-item">
                                          <strong>{component.name}</strong>
                                          {component.purpose && <span> — {component.purpose}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {msg.ideaCards?.selectable && (
                          <div className="brainstorm-selection-footer">
                            {msg.ideaCards.helperText && (
                              <div className="brainstorm-selection-helper">{msg.ideaCards.helperText}</div>
                            )}
                            <button
                              type="button"
                              className="brainstorm-confirm-btn"
                              onClick={() => handleIdeaConfirm(msg.id)}
                              disabled={!msg.ideaCards.selectedId || !!msg.ideaCards.submitted}
                            >
                              {msg.ideaCards.submitted ? 'Locked in' : (msg.ideaCards.confirmLabel || 'Continue')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {msg.breakdownCard && (
                      <div className="brainstorm-breakdown-card">
                        <div className="brainstorm-breakdown-title">{msg.breakdownCard.title}</div>
                        <div className="brainstorm-breakdown-list">
                          {msg.breakdownCard.steps.map((step, index) => (
                            <div key={`${msg.breakdownCard?.title}-${index}`} className="brainstorm-breakdown-step">
                              <span className="brainstorm-breakdown-index">{index + 1}</span>
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                        <div className="brainstorm-breakdown-note">{msg.breakdownCard.note}</div>
                      </div>
                    )}

                    {msg.finalProject && (
                      <div className="brainstorm-idea-cards">
                        <div className="brainstorm-idea-list">
                          <div className="brainstorm-idea-card brainstorm-idea-card--final">
                            <div className="brainstorm-idea-header">
                              <div className="brainstorm-idea-title-group">
                                <div className="brainstorm-idea-title">{msg.finalProject.title}</div>
                                {msg.finalProject.hook && <div className="brainstorm-idea-hook">{msg.finalProject.hook}</div>}
                              </div>
                              <span className={`brainstorm-difficulty-chip ${getBrainstormDifficultyClass(msg.finalProject.difficulty)}`}>
                                {formatDifficultyLabel(msg.finalProject.difficulty)}
                              </span>
                            </div>
                            <div className="brainstorm-idea-section">
                              <div className="brainstorm-idea-section-title">What it does</div>
                              <p>{msg.finalProject.whatItDoes}</p>
                            </div>
                            {msg.finalProject.components.length > 0 && (
                              <div className="brainstorm-idea-section">
                                <div className="brainstorm-idea-section-title">Components needed</div>
                                <div className="brainstorm-component-list">
                                  {msg.finalProject.components.map(component => (
                                    <div key={`${msg.id}-${component.name}`} className="brainstorm-component-item">
                                      <strong>{component.name}</strong>
                                      {component.purpose && <span> — {component.purpose}</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="brainstorm-project-summary">{msg.finalProject.summary}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {msg.twistCallout && (
                      <div className="brainstorm-twist-card">
                        <div className="brainstorm-twist-title">
                          <Lightbulb size={16} />
                          <span>{msg.twistCallout.title}</span>
                        </div>
                        <div className="brainstorm-twist-content">{msg.twistCallout.content}</div>
                      </div>
                    )}

                    {msg.actionButtons && (
                      <div className="brainstorm-action-buttons">
                        {msg.actionButtons.buttons.map(action => (
                          <button
                            key={action.id}
                            type="button"
                            className={`brainstorm-action-btn ${action.id === 'restart' ? 'brainstorm-action-btn--secondary' : ''}`}
                            onClick={() => handleActionButton(action.id, msg)}
                          >
                            {action.id === 'restart' && <RotateCcw size={14} />}
                            <span>{action.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {msg.id === startProjectMsgId && (
                  <div className="start-project-action">
                    <button className="start-project-btn" onClick={() => handleStartProject()}>
                      <span>Start Project</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="scan-chat-msg scan-chat-msg--assistant scan-chat-msg--thinking">
                <div className="scan-chat-avatar scan-chat-avatar--character">
                  <BlueCharacter
                    x={16}
                    y={16}
                    visible={true}
                    mood="thinking"
                    size="small"
                  />
                </div>
                <div className="scan-chat-bubble scan-chat-thinking-bubble">
                  <Loader2 size={16} className="scan-chat-thinking-spinner" />
                  <span className="scan-chat-thinking-text">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="scan-chat-input-area">
            <div className={`scan-chat-input-wrapper ${!canUseInput ? 'scan-chat-input-wrapper--disabled' : ''}`}>
              <input
                type="text"
                className="scan-chat-input"
                placeholder={inputPlaceholder}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                disabled={!canUseInput}
              />
              <button
                className="scan-chat-send"
                onClick={handleSend}
                disabled={!input.trim() || !canUseInput}
                type="button"
                aria-label="Send message"
              >
                {isLoading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
