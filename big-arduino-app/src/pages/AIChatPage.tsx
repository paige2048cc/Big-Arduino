import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, Loader2, ChevronRight, Cpu, Package, Check } from 'lucide-react';
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
type AmplifyActionId = 'expand' | 'combine' | 'decompose' | 'challenge' | 'resources';

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
}

interface SelectionCardData {
  kind: 'directions' | 'actions';
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

interface ProjectStartCardData {
  projectName: string;
  userOrigin: string;
  userChoices: string[];
  aiContribution: string[];
  ownershipLine: string;
  nextActions: string[];
  optionalTwist?: string;
}

interface BrainstormDirection {
  id: string;
  lens: string;
  title: string;
  description: string;
}

interface AmplifyResult {
  intro: string;
  items: {
    title: string;
    description: string;
    badge?: string;
  }[];
  recommendedFocus: {
    title: string;
    reason: string;
    difficulty: DifficultyLevel;
  };
}

interface RealizeResult {
  intro: string;
  project: EvaluationCardData & {
    userOrigin: string;
    userChoices: string[];
    aiContribution: string[];
    ownershipLine: string;
    nextActions: string[];
    optionalTwist?: string;
  };
  breakdown?: BreakdownCardData | null;
}

interface BrainstormSession {
  source: 'home' | 'scanner';
  stage: StageId;
  currentQuestion: SeedQuestionId | null;
  answers: Partial<Record<SeedQuestionId, string>>;
  knownComponents: string[];
  directions: BrainstormDirection[];
  selectedDirectionIds: string[];
  selectedActionId: AmplifyActionId | null;
  lastAmplifyResult: AmplifyResult | null;
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
  projectStartCard?: ProjectStartCardData;
}

const COMPONENT_KEYWORDS = [
  { label: 'LED', keywords: ['led', 'leds', 'light-emitting diode'] },
  { label: 'Buzzer', keywords: ['buzzer', 'piezo'] },
  { label: 'Button', keywords: ['button', 'push button', 'pushbutton', 'switch'] },
  { label: 'Potentiometer', keywords: ['potentiometer', 'knob'] },
  { label: 'Photoresistor', keywords: ['photoresistor', 'ldr', 'light sensor'] },
  { label: 'Ultrasonic Sensor', keywords: ['ultrasonic', 'hc-sr04', 'distance sensor'] },
  { label: 'PIR Sensor', keywords: ['pir', 'motion sensor'] },
  { label: 'Temperature Sensor', keywords: ['temperature sensor', 'lm35', 'dht11'] },
  { label: 'Soil Moisture Sensor', keywords: ['soil moisture', 'moisture sensor'] },
  { label: 'Servo', keywords: ['servo', 'servo motor'] },
  { label: 'LCD Display', keywords: ['lcd', 'display', 'screen'] },
  { label: 'OLED Display', keywords: ['oled'] },
];

const STAGE_COPY: Record<StageId, StageCardData> = {
  seed: {
    stage: 'seed',
    title: 'Stage S · Seed',
    description: 'Start from the user’s own words before AI branches outward.',
  },
  play: {
    stage: 'play',
    title: 'Stage P · Play',
    description: 'Scan the possibility space broadly before committing to one path.',
  },
  amplify: {
    stage: 'amplify',
    title: 'Stage A · Amplify',
    description: 'Let the user choose how AI should deepen the selected directions.',
  },
  realize: {
    stage: 'realize',
    title: 'Stage R · Realize',
    description: 'Turn one direction into a realistic starting path without overwhelming it.',
  },
};

const SEED_QUESTIONS: Record<SeedQuestionId, SeedQuestionCard> = {
  question1: {
    id: 'question1',
    index: 1,
    total: 3,
    prompt: 'What’s one feeling, frustration, curiosity, or moment you want this project to grow from?',
    hint: 'Keep it personal and simple. No need to think about circuits yet.',
  },
  question2: {
    id: 'question2',
    index: 2,
    total: 3,
    prompt: 'What Arduino parts or modules do you already have nearby, or most want to use?',
    hint: 'Name anything that feels exciting, even if you are not sure how to use it yet.',
  },
  question3: {
    id: 'question3',
    index: 3,
    total: 3,
    prompt: 'If you had one afternoon, what would you most want to make something *able to do*?',
    hint: 'Finish the blank in your own words: “I want to make something that can ...”',
  },
};

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
  { id: 'expand', title: 'Deepen', description: 'Push the selected direction into more concrete behaviors and details.' },
  { id: 'combine', title: 'Combine', description: 'Merge the directions you picked into one stronger concept.' },
  { id: 'decompose', title: 'Break Down', description: 'Preview a build path that turns the idea into smaller chunks.' },
  { id: 'challenge', title: 'Challenge', description: 'Ask a sharp question that tests what makes the idea meaningful.' },
  { id: 'resources', title: 'Resources First', description: 'Point to the key technical ingredients so the user can keep ideating.' },
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
    intro: `Your starting point is already clear: **${seed}**. Here are eight different ways to open it up without ranking them too early.`,
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
  if (action === 'challenge') {
    return {
      intro: 'Before building, pressure-test what would make this idea genuinely meaningful.',
      items: selected.map(direction => ({
        title: direction.title,
        description: `Who is this really for, and what would be lost if the project became simpler than ${direction.description.toLowerCase()}?`,
        badge: 'Challenge',
      })),
      recommendedFocus: {
        title: selected[0]?.title || 'Focused concept',
        reason: 'It keeps the original emotional hook while staying buildable.',
        difficulty: 'medium',
      },
    };
  }

  if (action === 'resources') {
    return {
      intro: 'Keep the creative control with the user and surface the key technical ingredients first.',
      items: [
        {
          title: 'Core interaction',
          description: 'Define the smallest input or output that proves the idea physically works.',
          badge: 'Resource',
        },
        {
          title: 'Component shortlist',
          description: `Start from ${session.knownComponents.join(', ') || 'LED, button, buzzer'} and add only one new part if needed.`,
          badge: 'Resource',
        },
        {
          title: 'Prototype constraint',
          description: 'Aim for a one-evening MVP before adding data, networking, or polish.',
          badge: 'Resource',
        },
      ],
      recommendedFocus: {
        title: selected[0]?.title || 'Lean prototype',
        reason: 'The most useful next move is to anchor the concept in one small prototype.',
        difficulty: 'easy',
      },
    };
  }

  if (action === 'combine' && selected.length > 1) {
    return {
      intro: 'Combine only the directions the user actually chose, so the hybrid still feels owned.',
      items: [
        {
          title: `${selected[0].title} + ${selected[1].title}`,
          description: `Blend ${selected[0].description.toLowerCase()} with ${selected[1].description.toLowerCase()} into a single stronger experience.`,
          badge: 'Combine',
        },
      ],
      recommendedFocus: {
        title: `${selected[0].title} remix`,
        reason: 'The blend creates a clearer project identity than either path alone.',
        difficulty: 'medium',
      },
    };
  }

  if (action === 'decompose') {
    return {
      intro: 'Preview the build path early so the project still feels reachable.',
      items: [
        { title: 'Step 1', description: 'Build one tiny interaction that proves the core behavior.', badge: 'Path' },
        { title: 'Step 2', description: 'Add the second component that makes the idea more expressive.', badge: 'Path' },
        { title: 'Step 3', description: 'Only then layer on polish or richer feedback.', badge: 'Path' },
      ],
      recommendedFocus: {
        title: selected[0]?.title || 'Stepped build',
        reason: 'Breaking it down makes the idea less overwhelming without shrinking it.',
        difficulty: 'medium',
      },
    };
  }

  return {
    intro: 'Take the selected directions and stretch them a little further before deciding what to build.',
    items: selected.map(direction => ({
      title: `${direction.title} MVP`,
      description: `Start with a minimal interaction that captures ${direction.description.toLowerCase()}.`,
      badge: 'Deepen',
    })),
    recommendedFocus: {
      title: selected[0]?.title || 'Promising direction',
      reason: 'It feels expressive while still being manageable for a first prototype.',
      difficulty: selected.length > 1 ? 'medium' : 'easy',
    },
  };
}

function buildRealizeFallback(session: BrainstormSession, amplify: AmplifyResult): RealizeResult {
  const focusTitle = amplify.recommendedFocus.title || session.directions.find(direction => session.selectedDirectionIds.includes(direction.id))?.title || 'New Arduino concept';
  const difficulty = amplify.recommendedFocus.difficulty;
  const components = uniqueStrings([
    ...session.knownComponents,
    difficulty === 'easy' ? 'Breadboard' : 'Sensor module',
  ]).slice(0, 5);

  return {
    intro: 'Here is a grounded project start card that keeps the user’s ownership visible and the next step clear.',
    project: {
      title: focusTitle,
      difficulty,
      tagline: 'A compact concept shaped by the user’s original seed and refined with AI.',
      creativeEvaluation: 'The concept is distinctive because it grows from a personal prompt instead of a generic starter project.',
      technicalEvaluation: `A ${difficulty} version is realistic if the first prototype stays narrow and uses only a few parts.`,
      components,
      timeEstimate: difficulty === 'hard' ? '2-3 weeks' : difficulty === 'medium' ? '1-2 weeks' : '1 evening to 1 weekend',
      hardestPart: difficulty === 'hard' ? 'Keeping the interaction coherent while adding complexity.' : 'Choosing the smallest useful first version.',
      tradeoff: 'Adding more features can make the idea richer, but it can also dilute the first successful build.',
      userOrigin: session.answers.question1 || session.answers.question3 || 'A personal starting idea.',
      userChoices: session.directions
        .filter(direction => session.selectedDirectionIds.includes(direction.id))
        .map(direction => direction.title),
      aiContribution: amplify.items.slice(0, 2).map(item => item.title),
      ownershipLine: 'The concept started from your own seed, and the AI only helped expand the path around it.',
      nextActions: ['Start with the MVP', 'Look up similar builds', 'Save this direction'],
      optionalTwist: 'Optional twist: add one tiny sensory detail, like a sound or pulse, only after the MVP works.',
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
  };
}

function buildDirectionsPrompt(session: BrainstormSession) {
  return `BRAINSTORM_JSON::
Create the P stage directions for an Arduino brainstorming flow.

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
- Keep the ideas realistically buildable with Arduino and named extra parts when needed.`;
}

function buildAmplifyPrompt(session: BrainstormSession) {
  const selected = session.directions.filter(direction => session.selectedDirectionIds.includes(direction.id));
  const selectedText = selected.map(direction => `- ${direction.title} (${direction.lens}): ${direction.description}`).join('\n');
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
  "items": [
    { "title": "string", "description": "string", "badge": "string" }
  ],
  "recommendedFocus": {
    "title": "string",
    "reason": "string",
    "difficulty": "easy | medium | hard"
  }
}

Rules:
- Follow the chosen action closely:
  - expand: deepen the selected direction(s)
  - combine: only combine the directions the user selected
  - decompose: preview how the direction can be built in chunks
  - challenge: ask provocative but constructive questions
  - resources: point to the most useful technical resources or ingredients first
- Return 1-3 items.
- Keep each description concise and concrete.
- The recommendedFocus should identify one promising direction to carry into Stage R.
- Stay grounded in Arduino reality and the known components.`;
}

function buildRealizePrompt(session: BrainstormSession, amplify: AmplifyResult) {
  return `BRAINSTORM_JSON::
Create the R stage output for an Arduino brainstorming flow.

User seed answers:
- Question 1: ${session.answers.question1 || 'N/A'}
- Question 2: ${session.answers.question2 || 'N/A'}
- Question 3: ${session.answers.question3 || 'N/A'}
- Known components: ${session.knownComponents.join(', ') || 'None explicitly known'}

Selected directions:
${session.directions.filter(direction => session.selectedDirectionIds.includes(direction.id)).map(direction => `- ${direction.title}: ${direction.description}`).join('\n')}

Amplify recommendation:
- Focus title: ${amplify.recommendedFocus.title}
- Reason: ${amplify.recommendedFocus.reason}
- Difficulty: ${amplify.recommendedFocus.difficulty}
- Amplify items:
${amplify.items.map(item => `- ${item.title}: ${item.description}`).join('\n')}

Return valid JSON only. No markdown fences. No extra prose.
Schema:
{
  "intro": "string",
  "project": {
    "title": "string",
    "difficulty": "easy | medium | hard",
    "tagline": "string",
    "creativeEvaluation": "string",
    "technicalEvaluation": "string",
    "components": ["string"],
    "timeEstimate": "string",
    "hardestPart": "string",
    "tradeoff": "string",
    "userOrigin": "string",
    "userChoices": ["string"],
    "aiContribution": ["string"],
    "ownershipLine": "string",
    "nextActions": ["string"],
    "optionalTwist": "string"
  },
  "breakdown": {
    "title": "string",
    "steps": ["string"],
    "note": "string"
  } | null
}

Rules:
- The project card must preserve ownership by referencing the user’s original seed in natural language.
- The evaluation must feel honest, not overhyped.
- If difficulty is medium or hard, breakdown is required and must contain 2-4 steps.
- The first breakdown step must be a tiny MVP, like lighting one LED or making a buzzer beep.
- Keep the breakdown short enough to avoid overwhelm.
- If difficulty is easy, set breakdown to null.`;
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

  const stripComponentRefs = (content: string): string =>
    content.replace(/\[\[(add|ref):[^\]]+\]\]\s*/g, '');

  const activeSelectionMessage = useMemo(
    () => [...messages].reverse().find(msg => msg.selectionCard && !msg.selectionCard.submitted) || null,
    [messages]
  );

  const canUseInput = !activeSelectionMessage && !isLoading;

  const inputPlaceholder = (() => {
    if (activeSelectionMessage?.selectionCard?.kind === 'directions') {
      return 'Choose 1-3 directions below to continue...';
    }
    if (activeSelectionMessage?.selectionCard?.kind === 'actions') {
      return 'Choose one AI action below to continue...';
    }
    if (brainstormSession?.stage === 'seed') {
      return 'Type your answer to the seed question...';
    }
    if (brainstormSession?.stage === 'realize') {
      return 'Ask a follow-up about this project idea...';
    }
    return 'Ask about your components or describe a project idea...';
  })();

  const getPageTitle = () => {
    if (brainstormSession) return 'AI Brainstorming';
    if (state?.detected && state.detected.length > 0) return 'Component Scanner';
    return 'AI Assistant';
  };

  const circuitState = useMemo(() => buildBrainstormCircuitState(state?.detected), [state?.detected]);

  const initializeBrainstormFromHome = (initialMessage: string) => {
    const knownComponents = extractKnownComponents(state?.detected, initialMessage);
    const nextQuestion = knownComponents.length > 0 ? 'question3' : 'question2';

    setBrainstormSession({
      source: 'home',
      stage: 'seed',
      currentQuestion: nextQuestion,
      answers: {
        question1: initialMessage,
        ...(knownComponents.length > 0 ? { question2: formatKnownComponentsAnswer(knownComponents) } : {}),
      },
      knownComponents,
      directions: [],
      selectedDirectionIds: [],
      selectedActionId: null,
      lastAmplifyResult: null,
    });

    setMessages([
      {
        id: createId('user'),
        role: 'user',
        content: initialMessage,
      },
      {
        id: createId('assistant'),
        role: 'assistant',
        content: knownComponents.length > 0
          ? 'This will grow from your words. You already mentioned some components, so I’ll fold that into the flow and skip the parts question.'
          : 'This will grow from your words. Let’s add one more practical seed before we branch outward.',
        stageCard: STAGE_COPY.seed,
        seedQuestion: SEED_QUESTIONS[nextQuestion],
      },
    ]);
  };

  const initializeBrainstormFromScanner = () => {
    const knownComponents = extractKnownComponents(state?.detected);
    setBrainstormSession({
      source: 'scanner',
      stage: 'seed',
      currentQuestion: 'question1',
      answers: {},
      knownComponents,
      directions: [],
      selectedDirectionIds: [],
      selectedActionId: null,
      lastAmplifyResult: null,
    });

    setMessages(prev => [
      ...prev,
      {
        id: createId('assistant'),
        role: 'assistant',
        content: knownComponents.length > 0
          ? 'Let’s start from the feeling or moment you care about first. I can already see your components, so Question 2 is covered and we’ll skip it later.'
          : 'Let’s start from the feeling or moment you care about first, then we’ll branch out together.',
        stageCard: STAGE_COPY.seed,
        seedQuestion: SEED_QUESTIONS.question1,
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
          stageCard: STAGE_COPY.play,
          selectionCard: {
            kind: 'directions',
            title: 'Choose 1-3 directions that feel worth developing.',
            subtitle: 'Displayed as a broad scan first, then you commit to a few.',
            options: fallback.directions.map(direction => ({
              id: direction.id,
              label: direction.title,
              description: direction.description,
              meta: direction.lens,
            })),
            multiSelect: true,
            maxSelections: 3,
            selectedIds: [],
            confirmLabel: 'Continue to Stage A',
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
          stageCard: STAGE_COPY.play,
          selectionCard: {
            kind: 'directions',
            title: 'Choose 1-3 directions that feel worth developing.',
            subtitle: 'Displayed as a broad scan first, then you commit to a few.',
            options: safeDirections.map(direction => ({
              id: direction.id,
              label: direction.title,
              description: direction.description,
              meta: direction.lens,
            })),
            multiSelect: true,
            maxSelections: 3,
            selectedIds: [],
            confirmLabel: 'Continue to Stage A',
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
          stageCard: STAGE_COPY.play,
          selectionCard: {
            kind: 'directions',
            title: 'Choose 1-3 directions that feel worth developing.',
            subtitle: 'Displayed as a broad scan first, then you commit to a few.',
            options: fallback.directions.map(direction => ({
              id: direction.id,
              label: direction.title,
              description: direction.description,
              meta: direction.lens,
            })),
            multiSelect: true,
            maxSelections: 3,
            selectedIds: [],
            confirmLabel: 'Continue to Stage A',
            columns: 2,
            helperText: 'Pick up to 3. More than that usually makes the next step too shallow.',
          },
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const requestRealizeStage = async (session: BrainstormSession, amplify: AmplifyResult) => {
    try {
      const response = await sendMessage(buildRealizePrompt(session, amplify), [], circuitState);
      const parsed = parseAIResponse(response.content);
      const payload = extractJsonPayload(parsed.content) as {
        intro?: string;
        project?: RealizeResult['project'];
        breakdown?: RealizeResult['breakdown'];
      };

      const fallback = buildRealizeFallback(session, amplify);
      const project = payload.project
        ? {
            ...payload.project,
            difficulty: normalizeDifficulty(payload.project.difficulty),
            components: Array.isArray(payload.project.components) ? payload.project.components : fallback.project.components,
            userChoices: Array.isArray(payload.project.userChoices) ? payload.project.userChoices : fallback.project.userChoices,
            aiContribution: Array.isArray(payload.project.aiContribution) ? payload.project.aiContribution : fallback.project.aiContribution,
            nextActions: Array.isArray(payload.project.nextActions) ? payload.project.nextActions : fallback.project.nextActions,
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
          stageCard: STAGE_COPY.realize,
          evaluationCard: {
            title: project.title,
            difficulty,
            tagline: project.tagline,
            creativeEvaluation: project.creativeEvaluation,
            technicalEvaluation: project.technicalEvaluation,
            components: project.components,
            timeEstimate: project.timeEstimate,
            hardestPart: project.hardestPart,
            tradeoff: project.tradeoff,
          },
          breakdownCard: normalizedBreakdown || undefined,
          projectStartCard: {
            projectName: project.title,
            userOrigin: project.userOrigin,
            userChoices: project.userChoices,
            aiContribution: project.aiContribution,
            ownershipLine: project.ownershipLine,
            nextActions: project.nextActions,
            optionalTwist: project.optionalTwist,
          },
        },
      ]);
    } catch (error) {
      console.error('Brainstorm realize error:', error);
      const fallback = buildRealizeFallback(session, amplify);
      setBrainstormSession(prev => prev ? { ...prev, stage: 'realize' } : prev);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: fallback.intro,
          stageCard: STAGE_COPY.realize,
          evaluationCard: fallback.project,
          breakdownCard: fallback.breakdown || undefined,
          projectStartCard: {
            projectName: fallback.project.title,
            userOrigin: fallback.project.userOrigin,
            userChoices: fallback.project.userChoices,
            aiContribution: fallback.project.aiContribution,
            ownershipLine: fallback.project.ownershipLine,
            nextActions: fallback.project.nextActions,
            optionalTwist: fallback.project.optionalTwist,
          },
        },
      ]);
    }
  };

  const requestAmplifyStage = async (session: BrainstormSession) => {
    if (!session.selectedActionId) return;

    setIsLoading(true);
    try {
      let amplify: AmplifyResult;
      if (!isAIServiceConfigured()) {
        amplify = buildAmplifyFallback(session);
      } else {
        const response = await sendMessage(buildAmplifyPrompt(session), [], circuitState);
        const parsed = parseAIResponse(response.content);
        const payload = extractJsonPayload(parsed.content) as AmplifyResult;
        amplify = {
          intro: payload.intro || buildAmplifyFallback(session).intro,
          items: Array.isArray(payload.items) && payload.items.length > 0 ? payload.items.slice(0, 3) : buildAmplifyFallback(session).items,
          recommendedFocus: payload.recommendedFocus
            ? {
                title: payload.recommendedFocus.title,
                reason: payload.recommendedFocus.reason,
                difficulty: normalizeDifficulty(payload.recommendedFocus.difficulty),
              }
            : buildAmplifyFallback(session).recommendedFocus,
        };
      }

      setBrainstormSession(prev => prev ? { ...prev, stage: 'amplify', lastAmplifyResult: amplify } : prev);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: amplify.intro,
          stageCard: STAGE_COPY.amplify,
          insightCard: {
            title: 'AI amplification',
            subtitle: amplify.recommendedFocus.reason,
            items: amplify.items,
          },
        },
      ]);

      await requestRealizeStage(
        {
          ...session,
          stage: 'amplify',
          lastAmplifyResult: amplify,
        },
        amplify
      );
    } catch (error) {
      console.error('Brainstorm amplify error:', error);
      const fallback = buildAmplifyFallback(session);
      setBrainstormSession(prev => prev ? { ...prev, stage: 'amplify', lastAmplifyResult: fallback } : prev);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: fallback.intro,
          stageCard: STAGE_COPY.amplify,
          insightCard: {
            title: 'AI amplification',
            subtitle: fallback.recommendedFocus.reason,
            items: fallback.items,
          },
        },
      ]);

      await requestRealizeStage(
        {
          ...session,
          stage: 'amplify',
          lastAmplifyResult: fallback,
        },
        fallback
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedAnswer = async (text: string) => {
    if (!brainstormSession || !brainstormSession.currentQuestion) return;

    const questionId = brainstormSession.currentQuestion;
    const nextAnswers = { ...brainstormSession.answers, [questionId]: text };
    let nextKnownComponents = brainstormSession.knownComponents;

    if (questionId === 'question1' || questionId === 'question2') {
      nextKnownComponents = uniqueStrings([...nextKnownComponents, ...detectMentionedComponents(text)]);
    }

    setMessages(prev => [
      ...prev,
      { id: createId('user'), role: 'user', content: text },
    ]);

    if (questionId === 'question1') {
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
      };
      setBrainstormSession(nextSession);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: hasComponentsAlready
            ? 'Nice. You already gave enough hints about the parts, so I’ll skip Question 2 and ask the last seed prompt.'
            : 'Good starting point. Let’s anchor it in the parts you actually have before we branch out.',
          stageCard: STAGE_COPY.seed,
          seedQuestion: SEED_QUESTIONS[nextQuestion],
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
      };
      setBrainstormSession(nextSession);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: 'Perfect. One last seed, then I’ll open up the idea space.',
          stageCard: STAGE_COPY.seed,
          seedQuestion: SEED_QUESTIONS.question3,
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
    };
    setBrainstormSession(completedSession);
    await requestDirections(completedSession);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading || activeSelectionMessage) return;
    setInput('');

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
      if (msg.projectStartCard || msg.selectionCard || msg.evaluationCard) continue;
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

  const handleStartProject = () => {
    navigate('/project/led-button');
  };

  const handleProjectClick = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  const updateSelectionCard = (messageId: string, updater: (card: SelectionCardData) => SelectionCardData) => {
    setMessages(prev => prev.map(msg => (
      msg.id === messageId && msg.selectionCard
        ? { ...msg, selectionCard: updater(msg.selectionCard) }
        : msg
    )));
  };

  const handleSelectionToggle = (messageId: string, optionId: string) => {
    const message = messages.find(msg => msg.id === messageId);
    const card = message?.selectionCard;
    if (!card || card.submitted) return;

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
          stageCard: STAGE_COPY.amplify,
          selectionCard: {
            kind: 'actions',
            title: 'Choose one action for Stage A.',
            subtitle: 'The AI follows your choice instead of deciding the next move for you.',
            options: AMPLIFY_ACTIONS.map(action => ({
              id: action.id,
              label: action.title,
              description: action.description,
            })),
            multiSelect: false,
            maxSelections: 1,
            selectedIds: [],
            confirmLabel: 'Run this action',
            columns: 2,
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

                    {msg.stageCard && (
                      <div className="brainstorm-stage-card">
                        <div className={`brainstorm-stage-badge brainstorm-stage-badge--${msg.stageCard.stage}`}>
                          {msg.stageCard.stage.toUpperCase()}
                        </div>
                        <div className="brainstorm-stage-copy">
                          <div className="brainstorm-stage-title">{msg.stageCard.title}</div>
                          <div className="brainstorm-stage-description">{msg.stageCard.description}</div>
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

                    {msg.seedQuestion && (
                      <div className="brainstorm-seed-card">
                        <div className="brainstorm-seed-counter">Question {msg.seedQuestion.index} / {msg.seedQuestion.total}</div>
                        <div className="brainstorm-seed-prompt">{msg.seedQuestion.prompt}</div>
                        {msg.seedQuestion.hint && (
                          <div className="brainstorm-seed-hint">{msg.seedQuestion.hint}</div>
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
                      <div className="brainstorm-selection-card">
                        <div className="brainstorm-selection-header">
                          <div className="brainstorm-selection-title">{msg.selectionCard.title}</div>
                          <div className="brainstorm-selection-subtitle">{msg.selectionCard.subtitle}</div>
                        </div>

                        <div className={`brainstorm-selection-grid brainstorm-selection-grid--${msg.selectionCard.columns || 1}`}>
                          {msg.selectionCard.options.map(option => {
                            const isSelected = msg.selectionCard!.selectedIds.includes(option.id);
                            return (
                              <button
                                key={option.id}
                                type="button"
                                className={`brainstorm-option-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleSelectionToggle(msg.id, option.id)}
                                disabled={msg.selectionCard?.submitted}
                              >
                                <div className="brainstorm-option-top">
                                  {option.meta && <span className="brainstorm-option-meta">{option.meta}</span>}
                                  <span className={`brainstorm-option-check ${isSelected ? 'selected' : ''}`}>
                                    {isSelected && <Check size={12} />}
                                  </span>
                                </div>
                                <div className="brainstorm-option-label">{option.label}</div>
                                <div className="brainstorm-option-description">{option.description}</div>
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

                    {msg.insightCard && (
                      <div className="brainstorm-insight-card">
                        <div className="brainstorm-insight-title">{msg.insightCard.title}</div>
                        {msg.insightCard.subtitle && (
                          <div className="brainstorm-insight-subtitle">{msg.insightCard.subtitle}</div>
                        )}
                        <div className="brainstorm-insight-list">
                          {msg.insightCard.items.map(item => (
                            <div key={item.title} className="brainstorm-insight-item">
                              {item.badge && <div className="brainstorm-insight-badge">{item.badge}</div>}
                              <div className="brainstorm-insight-item-title">{item.title}</div>
                              <div className="brainstorm-insight-item-description">{item.description}</div>
                            </div>
                          ))}
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

                    {msg.evaluationCard && (
                      <div className="brainstorm-evaluation-card">
                        <div className="brainstorm-evaluation-header">
                          <div>
                            <div className="brainstorm-evaluation-title">{msg.evaluationCard.title}</div>
                            <div className="brainstorm-evaluation-tagline">{msg.evaluationCard.tagline}</div>
                          </div>
                          <span className={`brainstorm-difficulty-chip ${getBrainstormDifficultyClass(msg.evaluationCard.difficulty)}`}>
                            {msg.evaluationCard.difficulty}
                          </span>
                        </div>
                        <div className="brainstorm-evaluation-grid">
                          <div className="brainstorm-evaluation-panel">
                            <div className="brainstorm-panel-title">Creative evaluation</div>
                            <p>{msg.evaluationCard.creativeEvaluation}</p>
                          </div>
                          <div className="brainstorm-evaluation-panel">
                            <div className="brainstorm-panel-title">Technical evaluation</div>
                            <p>{msg.evaluationCard.technicalEvaluation}</p>
                            <div className="brainstorm-tech-meta">
                              <div><strong>Parts:</strong> {msg.evaluationCard.components.join(', ')}</div>
                              <div><strong>Time:</strong> {msg.evaluationCard.timeEstimate}</div>
                              <div><strong>Hardest step:</strong> {msg.evaluationCard.hardestPart}</div>
                            </div>
                          </div>
                        </div>
                        <div className="brainstorm-tradeoff">
                          <strong>Worth considering:</strong> {msg.evaluationCard.tradeoff}
                        </div>
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

                    {msg.projectStartCard && (
                      <div className="brainstorm-start-card">
                        <div className="brainstorm-start-eyebrow">Project starting point</div>
                        <div className="brainstorm-start-title">{msg.projectStartCard.projectName}</div>
                        <div className="brainstorm-start-block">
                          <div className="brainstorm-start-label">Core seed from the user</div>
                          <p>{msg.projectStartCard.userOrigin}</p>
                        </div>
                        <div className="brainstorm-start-block">
                          <div className="brainstorm-start-label">Directions the user chose</div>
                          <div className="brainstorm-token-list">
                            {msg.projectStartCard.userChoices.map(choice => (
                              <span key={choice} className="brainstorm-token">{choice}</span>
                            ))}
                          </div>
                        </div>
                        <div className="brainstorm-start-block">
                          <div className="brainstorm-start-label">AI helped expand</div>
                          <div className="brainstorm-token-list">
                            {msg.projectStartCard.aiContribution.map(choice => (
                              <span key={choice} className="brainstorm-token brainstorm-token--soft">{choice}</span>
                            ))}
                          </div>
                        </div>
                        <div className="brainstorm-start-ownership">{msg.projectStartCard.ownershipLine}</div>
                        <div className="brainstorm-start-block">
                          <div className="brainstorm-start-label">Next actions</div>
                          <div className="brainstorm-token-list">
                            {msg.projectStartCard.nextActions.map(action => (
                              <span key={action} className="brainstorm-token">{action}</span>
                            ))}
                          </div>
                        </div>
                        {msg.projectStartCard.optionalTwist && (
                          <div className="brainstorm-optional-twist">{msg.projectStartCard.optionalTwist}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {msg.id === startProjectMsgId && (
                  <div className="start-project-action">
                    <button className="start-project-btn" onClick={handleStartProject}>
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
