// Project Types
export interface ProjectStep {
  id: number;
  title: string;
  description: string;
  instructions: string[];
  tips?: string[];
  componentImage?: string;
  wiringImage?: string;
  code?: string;
  interactiveElements?: InteractiveElement[];
}

export interface InteractiveElement {
  type: 'led' | 'button' | 'sensor';
  pin: number;
  label: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  image: string;
  estimatedTime: string;
  components: Component[];
  steps: ProjectStep[];
  arduinoCode: string;
}

export interface Component {
  name: string;
  quantity: number;
  image?: string;
}

// AI Chat Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
