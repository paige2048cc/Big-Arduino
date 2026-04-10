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
}

interface RealizeResult {
  intro: string;
  project: FinalProjectData;
  breakdown?: BreakdownCardData | null;
  twist?: string;
}

interface BrainstormSession {
  source: 'home' | 'scanner';
  stage: StageId;
  currentQuestion: SeedQuestionId | 'question1-followup' | null;
  answers: Partial<Record<SeedQuestionId, string>>;
  knownComponents: string[];
  directions: BrainstormDirection[];
  selectedDirectionIds: string[];
  selectedActionId: AmplifyActionId | null;
  lastAmplifyResult: AmplifyResult | null;
  amplifyIdeas: BrainstormIdea[];
  selectedIdeaId: string | null;
  askedSeedFollowUp: boolean;
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
  const baseParts = session.knownComponents.length > 0 ? session.knownComponents : ['Arduino Uno', 'Breadboard', 'Jumper wires'];
  const focus = selected[0];

  if (action === 'decompose') {
    return {
      intro: 'Here are a few ways to keep the idea intact while making the first build smaller and easier to start.',
      ideas: [
        {
          id: 'decompose-mvp',
          title: `${focus?.title || 'Core idea'} MVP`,
          difficulty: 'easy',
          hook: 'Start with one small behavior that proves the feeling is there.',
          whatItDoes: 'This version strips the project down to one sensor input and one clear output so the core interaction works first.',
          components: [
            { name: baseParts[0], purpose: 'Runs the first prototype logic.' },
            { name: baseParts[1] || 'LED', purpose: 'Provides the clearest first feedback.' },
            { name: baseParts[2] || 'Buzzer', purpose: 'Adds one more expressive signal only if needed.' },
          ],
        },
        {
          id: 'decompose-expanded',
          title: `${focus?.title || 'Core idea'} plus one layer`,
          difficulty: 'medium',
          hook: 'Keep the same concept, then add one richer interaction after the MVP works.',
          whatItDoes: 'After the base interaction is stable, this version adds a second feedback layer so the project feels more alive without becoming too complex.',
          components: [
            { name: baseParts[0], purpose: 'Coordinates the sensor and output behavior.' },
            { name: baseParts[1] || 'Sensor module', purpose: 'Captures the main trigger or environmental change.' },
            { name: 'LED', purpose: 'Shows a visible response in the space.' },
            { name: 'Buzzer', purpose: 'Adds a simple audio cue.' },
          ],
        },
      ],
      helperText: 'Pick one version to carry into the full project description.',
    };
  }

  if (action === 'challenge') {
    return {
      intro: 'A useful challenge here is deciding what should make this idea feel meaningful instead of just technically working.',
      ideas: [
        {
          id: 'challenge-subtle',
          title: `${focus?.title || 'Subtle version'}`,
          difficulty: 'easy',
          hook: 'What if the project stayed quiet and let the tension come from anticipation instead of alarms?',
          whatItDoes: 'This version reacts gently, using minimal light or sound so the emotional tone stays subtle and psychological.',
          components: [
            { name: baseParts[0], purpose: 'Runs the lightweight behavior logic.' },
            { name: 'LED', purpose: 'Creates a restrained visual cue.' },
            { name: '220Ω resistor', purpose: 'Protects the LED.' },
          ],
        },
        {
          id: 'challenge-expressive',
          title: `${focus?.title || 'Expressive version'}`,
          difficulty: 'medium',
          hook: 'Or should the project make the emotion unmistakable the moment something changes?',
          whatItDoes: 'This version responds more dramatically, layering light and sound so the atmosphere feels immediate and obvious.',
          components: [
            { name: baseParts[0], purpose: 'Coordinates the stronger response.' },
            { name: baseParts[1] || 'Ultrasonic Distance Sensor', purpose: 'Detects movement or proximity.' },
            { name: 'LED', purpose: 'Builds urgency visually.' },
            { name: 'Buzzer', purpose: 'Adds a rising sound cue.' },
          ],
        },
      ],
      helperText: 'Choose the tone you want, then continue.',
    };
  }

  if (action === 'resources') {
    return {
      intro: 'If you want to keep ideating while staying grounded, these are the most practical build directions to hold onto.',
      ideas: [
        {
          id: 'resources-basic',
          title: `${focus?.title || 'Practical direction'}`,
          difficulty: 'easy',
          hook: 'A lean prototype built from the parts already closest to hand.',
          whatItDoes: 'This version focuses on one sensor and one response, which makes it easy to test, tweak, and reimagine later.',
          components: [
            { name: baseParts[0], purpose: 'Runs the prototype logic.' },
            { name: baseParts[1] || 'Sensor module', purpose: 'Captures the key input.' },
            { name: 'LED', purpose: 'Shows immediate feedback.' },
          ],
        },
        {
          id: 'resources-rich',
          title: `${focus?.title || 'Expanded direction'}`,
          difficulty: 'medium',
          hook: 'The same idea, but with one extra layer that makes it feel more intentional.',
          whatItDoes: 'This direction keeps the same core behavior and adds a second output or sensor so the interaction feels more complete.',
          components: [
            { name: baseParts[0], purpose: 'Coordinates the richer interaction.' },
            { name: baseParts[1] || 'Sensor module', purpose: 'Provides the main trigger.' },
            { name: 'LED', purpose: 'Creates visible feedback.' },
            { name: 'Buzzer', purpose: 'Adds atmosphere or warning.' },
          ],
        },
      ],
      helperText: 'Choose the version you want to flesh out next.',
    };
  }

  if (action === 'combine' && selected.length > 1) {
    return {
      intro: 'These combinations stay close to the directions you chose, but connect them into fuller project concepts.',
      ideas: [
        {
          id: 'combine-balanced',
          title: `${selected[0].title} + ${selected[1].title}`,
          difficulty: 'medium',
          hook: 'A balanced combination that keeps both ideas recognizable.',
          whatItDoes: `This concept blends ${selected[0].description.toLowerCase()} with ${selected[1].description.toLowerCase()} so the project feels both coherent and surprising.`,
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
          hook: 'A more experimental version that pushes the same pairing further.',
          whatItDoes: 'This version turns the combined idea into a more immersive interaction, with extra feedback and a broader sensing range.',
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
    intro: 'Here are a few fuller directions that keep your chosen idea but make it concrete enough to build next.',
    ideas: selected.slice(0, 3).map((direction, index) => ({
      id: `${direction.id}-deepen-${index + 1}`,
      title: index === 0 ? direction.title : `${direction.title} variation ${index + 1}`,
      difficulty: index === 0 ? 'medium' : index === 1 ? 'easy' : 'hard',
      hook: index === 0
        ? 'The most balanced version: expressive, buildable, and still open to iteration.'
        : index === 1
          ? 'A simpler version that proves the idea quickly.'
          : 'A more ambitious version that pushes the same feeling further.',
      whatItDoes: `This concept develops ${direction.description.toLowerCase()} into a clearer Arduino interaction with a stronger sense of behavior and feedback.`,
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
  - decompose: preview how the direction can be built in chunks
  - challenge: ask provocative but constructive questions
  - resources: point to the most useful technical resources or ingredients first
- Return 2-4 ideas.
- Each idea should feel like a real project direction, not a short note.
- Each idea must include a short hook, a concise "what it does" paragraph, and a components list with purpose for each component.
- Keep the tone close to the main branch exploring style: vivid, warm, and practical.
- Include difficulty labels directly in the data.
- Stay grounded in Arduino reality and the known components.`;
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
    if (activeIdeaSelectionMessage?.ideaCards?.selectable) {
      return 'Choose one project direction below to continue...';
    }
    if (brainstormSession?.stage === 'seed') {
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
      amplifyIdeas: [],
      selectedIdeaId: null,
      askedSeedFollowUp: false,
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
          ? 'Nice starting point. You already mentioned some parts, so let’s focus on what you most want this thing to do if you had one afternoon to make it.'
          : 'Nice starting point. What Arduino parts or modules do you already have nearby, or most want to use for this idea?',
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
      amplifyIdeas: [],
      selectedIdeaId: null,
      askedSeedFollowUp: false,
    });

    const componentNames = knownComponents.join(', ');
    const fallback = componentNames
      ? `I see you've got **${componentNames.toLowerCase()}** — that's a fascinating place to start. What kind of **feeling or theme** are you drawn to exploring? Maybe something about presence and absence, personal space, or something that responds to movement?`
      : 'Tell me — is there a feeling, theme, or idea you’d like to express through a project?';

    setMessages(prev => [...prev, { id: createId('assistant'), role: 'assistant', content: fallback }]);
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
        };
        amplify = {
          intro: payload.intro || buildAmplifyFallback(session).intro,
          ideas: Array.isArray(payload.ideas) && payload.ideas.length > 0
            ? payload.ideas.slice(0, 4).map((idea, index) => normalizeIdea(idea, `amplify-${index + 1}`))
            : buildAmplifyFallback(session).ideas,
          helperText: cleanInlineMarkdown(payload.helperText || buildAmplifyFallback(session).helperText || ''),
        };
      }

      setBrainstormSession(prev => prev ? {
        ...prev,
        stage: 'amplify',
        lastAmplifyResult: amplify,
        amplifyIdeas: amplify.ideas,
        selectedIdeaId: null,
      } : prev);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: amplify.intro,
          ideaCards: {
            title: 'Here are a few stronger directions to choose from.',
            subtitle: session.selectedActionId === 'challenge'
              ? 'These are shaped by a harder question about what you want the project to feel like.'
              : undefined,
            ideas: amplify.ideas,
            selectable: true,
            selectedId: null,
            confirmLabel: 'Continue',
            helperText: amplify.helperText,
          },
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
      } : prev);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: fallback.intro,
          ideaCards: {
            title: 'Here are a few stronger directions to choose from.',
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
    const nextAnswers = questionId === 'question1-followup'
      ? {
          ...brainstormSession.answers,
          question1: [brainstormSession.answers.question1, text].filter(Boolean).join(' | '),
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
      };
      setBrainstormSession(nextSession);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: hasComponentsAlready
            ? 'That gives me something real to work with. If you had one afternoon, what would you most want to make something able to do?'
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
      };
      setBrainstormSession(nextSession);
      setMessages(prev => [
        ...prev,
        {
          id: createId('assistant'),
          role: 'assistant',
          content: 'Nice. If you had one afternoon, what would you most want to make something able to do?',
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
    if (!text || isLoading || activeSelectionMessage || activeIdeaSelectionMessage) return;
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

  const handleStartProject = () => {
    navigate('/project/led-button');
  };

  const handleProjectClick = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  const handleRestartBrainstorm = () => {
    navigate('/ai-chat', { state });
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
          selectionCard: {
            kind: 'actions',
            title: 'How should I help with these directions?',
            subtitle: 'Choose one action.',
            options: AMPLIFY_ACTIONS.map(action => ({
              id: action.id,
              label: action.title,
              description: action.description,
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

  const handleActionButton = (actionId: 'start-project' | 'restart') => {
    if (actionId === 'start-project') {
      handleStartProject();
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
                            onClick={() => handleActionButton(action.id)}
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
