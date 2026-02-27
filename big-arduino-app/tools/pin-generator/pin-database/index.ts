/**
 * Pin Database Loader
 *
 * Loads pre-defined pin configurations for common components.
 * Pin data comes from official Arduino documentation and component datasheets.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TemplatePinDefinition {
  id: string;
  label: string;
  description: string;
  type: 'power' | 'ground' | 'digital' | 'analog' | 'pwm' | 'communication' | 'terminal';
  /**
   * Optional net/group identifier for internally connected pins.
   * Pins with the same `net` value are electrically connected internally.
   * Examples:
   * - Breadboard row: "row-1-left" groups holes A1-E1
   * - Power rail: "power-top" groups all + rail holes
   */
  net?: string;
}

export interface ComponentTemplate {
  componentId: string;
  componentName: string;
  category: string;
  source: string;
  description?: string;
  pins: TemplatePinDefinition[];
}

/**
 * Get all available templates
 */
export function listTemplates(): { id: string; name: string; category: string; pinCount: number }[] {
  const templates: { id: string; name: string; category: string; pinCount: number }[] = [];
  const categories = ['microcontrollers', 'passive', 'sensors', 'actuators', 'boards'];

  for (const category of categories) {
    const categoryPath = path.join(__dirname, category);
    if (!fs.existsSync(categoryPath)) continue;

    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(categoryPath, file), 'utf-8');
        const template = JSON.parse(content) as ComponentTemplate;
        templates.push({
          id: template.componentId,
          name: template.componentName,
          category: template.category,
          pinCount: template.pins.length
        });
      } catch {
        // Skip invalid files
      }
    }
  }

  return templates;
}

/**
 * Load a specific template by ID
 */
export function loadTemplate(templateId: string): ComponentTemplate | null {
  const categories = ['microcontrollers', 'passive', 'sensors', 'actuators', 'boards'];

  for (const category of categories) {
    const categoryPath = path.join(__dirname, category);
    if (!fs.existsSync(categoryPath)) continue;

    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(categoryPath, file), 'utf-8');
        const template = JSON.parse(content) as ComponentTemplate;
        if (template.componentId === templateId) {
          return template;
        }
      } catch {
        // Skip invalid files
      }
    }
  }

  return null;
}

/**
 * Get all templates as a map for the editor
 */
export function getAllTemplates(): Map<string, ComponentTemplate> {
  const templates = new Map<string, ComponentTemplate>();
  const categories = ['microcontrollers', 'passive', 'sensors', 'actuators', 'boards'];

  for (const category of categories) {
    const categoryPath = path.join(__dirname, category);
    if (!fs.existsSync(categoryPath)) continue;

    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(categoryPath, file), 'utf-8');
        const template = JSON.parse(content) as ComponentTemplate;
        templates.set(template.componentId, template);
      } catch {
        // Skip invalid files
      }
    }
  }

  return templates;
}

/**
 * Convert template pins to component definition pins (with placeholder positions)
 */
export function templateToPins(template: ComponentTemplate): Array<{
  id: string;
  label: string;
  description: string;
  type: string;
  x: number;
  y: number;
  hitRadius: number;
  placed: boolean;
  net?: string;
}> {
  return template.pins.map((pin, index) => ({
    id: pin.id,
    label: pin.label,
    description: pin.description,
    type: pin.type,
    x: 50 + (index % 5) * 60,  // Placeholder positions in a grid
    y: 50 + Math.floor(index / 5) * 60,
    hitRadius: 8,
    placed: false,  // Track if user has placed this pin
    ...(pin.net && { net: pin.net })  // Include net if defined
  }));
}
