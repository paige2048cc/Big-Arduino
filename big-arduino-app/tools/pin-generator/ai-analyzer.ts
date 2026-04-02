/**
 * AI Vision Analyzer
 *
 * Uses Claude Vision API or Google Gemini to analyze component images
 * and detect pin locations, labels, and functions.
 *
 * Set AI_PROVIDER=gemini to use Google Gemini, otherwise uses Anthropic Claude.
 */

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import { getImageDimensions } from './scanner';

export interface PinDefinition {
  id: string;
  label: string;
  description: string;
  type: 'power' | 'ground' | 'digital' | 'analog' | 'pwm' | 'communication' | 'terminal';
  x: number;
  y: number;
  hitRadius: number;
}

export interface ComponentDefinition {
  id: string;
  name: string;
  category: string;
  image: string;
  width: number;
  height: number;
  pins: PinDefinition[];
}

const PIN_DETECTION_PROMPT = `Analyze this electronic component image for an Arduino circuit designer app.

Your task is to identify ALL pins/connection points and their exact pixel locations.

## Instructions:

1. **Identify the component type** (Arduino board, LED, resistor, sensor, etc.)

2. **Find ALL pins/connection points** visible in the image:
   - For Arduino/microcontrollers: all header pins (digital, analog, power, ground)
   - For LEDs: anode (+) and cathode (-) legs
   - For resistors: both terminal legs
   - For sensors: all connection pins (VCC, GND, signal pins)
   - For buttons: all terminal pins
   - For breadboards: representative holes for power rails and terminal strips

3. **Estimate pixel coordinates** for each pin:
   - Coordinates are relative to the top-left corner of the image (0,0)
   - X increases to the right, Y increases downward
   - Be as precise as possible - these will be used for hover detection

4. **Classify each pin's type**:
   - "power": VCC, 5V, 3.3V, Vin
   - "ground": GND
   - "digital": Digital I/O pins (D0-D13, etc.)
   - "analog": Analog input pins (A0-A5, etc.)
   - "pwm": PWM-capable pins (often marked with ~)
   - "communication": TX, RX, SDA, SCL, MOSI, MISO, SCK
   - "terminal": Generic connection points (LED legs, resistor terminals)

## Response Format:

Return ONLY a valid JSON object (no markdown, no explanation) with this structure:

{
  "componentType": "string describing the component",
  "pins": [
    {
      "id": "unique_pin_id",
      "label": "Display label (e.g., 'Digital 13', 'GND', 'Anode')",
      "description": "Detailed description of pin function",
      "type": "power|ground|digital|analog|pwm|communication|terminal",
      "x": 123,
      "y": 456,
      "hitRadius": 8
    }
  ]
}

## Important:
- Include ALL visible pins, even if there are many
- For Arduino boards, include EVERY pin header
- Be precise with coordinates - users will hover over these exact locations
- Use English for labels, but you can include Chinese translations in parentheses for common terms
- The hitRadius should be 6-10 pixels depending on pin size`;

/**
 * Analyze a component image using Claude Vision API
 */
async function analyzeWithClaude(
  imagePath: string,
  base64Image: string,
  mediaType: string
): Promise<{ componentType: string; pins: PinDefinition[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const anthropic = new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: PIN_DETECTION_PROMPT,
          },
        ],
      },
    ],
  });

  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return parseAIResponse(textContent.text);
}

/**
 * Analyze a component image using Google Gemini Vision API
 */
async function analyzeWithGemini(
  imagePath: string,
  base64Image: string,
  mediaType: string
): Promise<{ componentType: string; pins: PinDefinition[] }> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY environment variable is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: mediaType,
        data: base64Image,
      },
    },
    { text: PIN_DETECTION_PROMPT },
  ]);

  const response = result.response;
  const text = response.text();

  if (!text) {
    throw new Error('No text response from Gemini');
  }

  return parseAIResponse(text);
}

/**
 * Parse AI response JSON
 */
function parseAIResponse(text: string): { componentType: string; pins: PinDefinition[] } {
  let jsonStr = text.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }

  jsonStr = jsonStr.trim();

  try {
    return JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('Failed to parse AI response:', text.substring(0, 500));
    throw new Error('Failed to parse AI response as JSON');
  }
}

/**
 * Analyze a component image using AI Vision (Claude or Gemini)
 */
export async function analyzeComponent(
  imagePath: string,
  name: string,
  category: string
): Promise<ComponentDefinition> {
  // Determine which AI provider to use
  const provider = process.env.AI_PROVIDER?.toLowerCase() || 'claude';

  // Read and encode image
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  // Determine media type
  const ext = path.extname(imagePath).toLowerCase();
  const mediaType = ext === '.png' ? 'image/png' :
                    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                    ext === '.webp' ? 'image/webp' : 'image/png';

  // Get image dimensions
  const dimensions = getImageDimensions(imagePath) || { width: 500, height: 400 };

  // Call the appropriate AI provider
  let aiResult: { componentType: string; pins: PinDefinition[] };

  if (provider === 'gemini') {
    console.log(' [Gemini]');
    aiResult = await analyzeWithGemini(imagePath, base64Image, mediaType);
  } else {
    console.log(' [Claude]');
    aiResult = await analyzeWithClaude(imagePath, base64Image, mediaType);
  }

  // Build component definition
  const componentDef: ComponentDefinition = {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name: formatComponentName(name),
    category,
    image: path.basename(imagePath),
    width: dimensions.width,
    height: dimensions.height,
    pins: aiResult.pins.map(pin => ({
      ...pin,
      hitRadius: pin.hitRadius || 8,
    })),
  };

  return componentDef;
}

/**
 * Format component name for display
 */
function formatComponentName(name: string): string {
  // Convert kebab-case or snake_case to Title Case
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
