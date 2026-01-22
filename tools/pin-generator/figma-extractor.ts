/**
 * Figma Pin Extractor
 *
 * Extracts pin positions from Figma designs using the Figma REST API.
 * Pins should be marked in Figma as small shapes (circles/ellipses) with
 * names following the format: {id}:{label}:{type}
 *
 * Example marker names:
 *   - "D13:Digital 13:digital"
 *   - "GND:Ground:ground"
 *   - "A0:Analog 0:analog"
 */

import type { PinDefinition } from './ai-analyzer.js';

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  children?: FigmaNode[];
}

interface FigmaFileResponse {
  document: FigmaNode;
  name: string;
}

interface FigmaNodeResponse {
  nodes: Record<string, { document: FigmaNode }>;
}

interface ExtractedPins {
  pins: PinDefinition[];
  frameWidth: number;
  frameHeight: number;
}

/**
 * Parse Figma URL to extract file key and node ID
 */
export function parseFigmaUrl(url: string): { fileKey: string; nodeId?: string } {
  // Handle various Figma URL formats:
  // https://www.figma.com/file/ABC123/FileName
  // https://www.figma.com/design/ABC123/FileName
  // https://www.figma.com/file/ABC123/FileName?node-id=1-2
  // https://www.figma.com/design/ABC123/FileName?node-id=1%3A2

  const fileMatch = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  const nodeMatch = url.match(/node-id=([^&]+)/);

  if (!fileMatch) {
    throw new Error('Invalid Figma URL. Expected format: https://www.figma.com/file/KEY/...');
  }

  let nodeId: string | undefined;
  if (nodeMatch) {
    // Decode URL-encoded node ID (1%3A2 -> 1:2) and convert dash format (1-2 -> 1:2)
    nodeId = decodeURIComponent(nodeMatch[1]).replace('-', ':');
  }

  return {
    fileKey: fileMatch[1],
    nodeId
  };
}

/**
 * Parse pin marker name to extract id, label, and type
 * Format: {id}:{label}:{type} or just {id}
 */
function parsePinName(name: string): { id: string; label: string; type: PinDefinition['type'] } {
  const parts = name.split(':').map(p => p.trim());

  const validTypes: PinDefinition['type'][] = [
    'power', 'ground', 'digital', 'analog', 'pwm', 'communication', 'terminal'
  ];

  const id = parts[0] || 'pin';
  const label = parts[1] || id;
  const typeStr = parts[2]?.toLowerCase() || 'digital';
  const type = validTypes.includes(typeStr as PinDefinition['type'])
    ? (typeStr as PinDefinition['type'])
    : 'digital';

  return { id, label, type };
}

/**
 * Check if a node is a pin marker (circle/ellipse shape)
 */
function isPinMarker(node: FigmaNode): boolean {
  // Look for ellipse/circle shapes, or any shape in a "pins" group
  return node.type === 'ELLIPSE' ||
         node.type === 'CIRCLE' ||
         (node.type === 'RECTANGLE' && node.name.toLowerCase().includes('pin'));
}

/**
 * Recursively find all pin markers in the node tree
 */
function findPinMarkers(
  node: FigmaNode,
  inPinsGroup: boolean = false
): FigmaNode[] {
  const markers: FigmaNode[] = [];

  // Check if this is a "pins" group
  const isPinsGroup = node.name.toLowerCase() === 'pins' ||
                      node.name.toLowerCase().includes('pin-markers');

  if (inPinsGroup || isPinsGroup) {
    // In pins group, collect ellipse/circle shapes
    if (isPinMarker(node) && node.absoluteBoundingBox) {
      markers.push(node);
    }
  }

  // Recurse into children
  if (node.children) {
    for (const child of node.children) {
      markers.push(...findPinMarkers(child, inPinsGroup || isPinsGroup));
    }
  }

  return markers;
}

/**
 * Find the main frame (component image frame) in the node tree
 */
function findMainFrame(node: FigmaNode): FigmaNode | null {
  // Look for the largest frame that's not the document root
  if (node.type === 'FRAME' && node.absoluteBoundingBox) {
    return node;
  }

  if (node.children) {
    for (const child of node.children) {
      const frame = findMainFrame(child);
      if (frame) return frame;
    }
  }

  return null;
}

/**
 * Extract pins from Figma using the REST API
 */
export async function extractPinsFromFigmaApi(
  figmaUrl: string,
  accessToken?: string
): Promise<ExtractedPins> {
  const token = accessToken || process.env.FIGMA_TOKEN || process.env.FIGMA_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      'Figma access token required. Set FIGMA_TOKEN environment variable.\n' +
      'Get a token from: https://www.figma.com/developers/api#access-tokens'
    );
  }

  const { fileKey, nodeId } = parseFigmaUrl(figmaUrl);

  // Fetch file/node data from Figma API
  let data: FigmaNode;
  let frameBounds: { x: number; y: number; width: number; height: number };

  if (nodeId) {
    // Fetch specific node
    const response = await fetch(
      `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
      {
        headers: { 'X-Figma-Token': token }
      }
    );

    if (!response.ok) {
      throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json() as FigmaNodeResponse;
    const nodeData = json.nodes[nodeId];

    if (!nodeData) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    data = nodeData.document;
  } else {
    // Fetch entire file
    const response = await fetch(
      `https://api.figma.com/v1/files/${fileKey}`,
      {
        headers: { 'X-Figma-Token': token }
      }
    );

    if (!response.ok) {
      throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json() as FigmaFileResponse;
    data = json.document;
  }

  // Find the main frame
  const mainFrame = findMainFrame(data);
  if (!mainFrame || !mainFrame.absoluteBoundingBox) {
    throw new Error('Could not find main frame in Figma design');
  }

  frameBounds = mainFrame.absoluteBoundingBox;

  // Find all pin markers
  const markers = findPinMarkers(data);

  if (markers.length === 0) {
    console.warn('⚠️  No pin markers found. Make sure to:');
    console.warn('   1. Create a group/frame named "pins"');
    console.warn('   2. Add circle/ellipse shapes at pin locations');
    console.warn('   3. Name each shape: {id}:{label}:{type}');
  }

  // Convert markers to pin definitions
  const pins: PinDefinition[] = markers.map(marker => {
    const { id, label, type } = parsePinName(marker.name);
    const bounds = marker.absoluteBoundingBox!;

    // Calculate position relative to main frame
    const x = (bounds.x - frameBounds.x) + (bounds.width / 2);
    const y = (bounds.y - frameBounds.y) + (bounds.height / 2);

    return {
      id,
      label,
      description: '',
      type,
      x: Math.round(x),
      y: Math.round(y),
      hitRadius: Math.round(Math.max(bounds.width, bounds.height) / 2) || 8
    };
  });

  return {
    pins,
    frameWidth: Math.round(frameBounds.width),
    frameHeight: Math.round(frameBounds.height)
  };
}

/**
 * Create empty pin template for manual mode
 */
export function createEmptyPinTemplate(
  imagePath: string,
  name: string,
  category: string,
  width: number,
  height: number
): { id: string; name: string; category: string; image: string; width: number; height: number; pins: PinDefinition[] } {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name: name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    category,
    image: imagePath.split(/[/\\]/).pop() || imagePath,
    width,
    height,
    pins: []
  };
}
