/**
 * Validation Service
 *
 * Provides runtime validation for component definitions and knowledge files
 * using Zod schemas to ensure data integrity.
 */

import { z } from 'zod';

// Pin Types
export const PinTypeSchema = z.enum([
  'digital',
  'pwm',
  'analog',
  'communication',
  'power',
  'ground',
  'terminal',
  'i2c',
  'spi',
  'uart',
]);

export const SemanticFunctionTypeSchema = z.enum([
  'digital',
  'analog',
  'pwm',
  'i2c',
  'spi',
  'uart',
  'power',
  'gnd',
  'clock',
  'data',
  'trigger',
  'echo',
  'other',
]);

export const ComponentProtocolSchema = z.enum([
  'digital',
  'analog',
  'pwm',
  'i2c',
  'spi',
  'uart',
  'power',
  'other',
]);

// Pin Function Definition
export const PinFunctionDefinitionSchema = z.object({
  name: z.string(),
  type: SemanticFunctionTypeSchema,
});

// Function Type Definition
export const FunctionTypeDefinitionSchema = z.object({
  value: SemanticFunctionTypeSchema,
  label: z.string(),
});

// Knowledge References
export const KnowledgeRefsSchema = z.object({
  component: z.string().optional(),
  concepts: z.array(z.string()).optional(),
  recipes: z.array(z.string()).optional(),
});

// Component Source Info
export const ComponentSourceInfoSchema = z.object({
  origin: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
});

// Component Compatibility
export const ComponentCompatibilitySchema = z.object({
  boards: z.array(z.string()).optional(),
  voltage: z.array(z.string()).optional(),
  notes: z.array(z.string()).optional(),
});

// Pin Definition
export const PinSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  type: PinTypeSchema,
  x: z.number(),
  y: z.number(),
  hitRadius: z.number(),
  net: z.string().optional(),
  functions: z.array(PinFunctionDefinitionSchema).optional(),
  electricalRole: z.string().optional(),
  polarity: z.enum(['positive', 'negative', 'neutral']).optional(),
  preferredMatches: z.array(z.string()).optional(),
  aliases: z.array(z.string()).optional(),
  required: z.boolean().optional(),
  notes: z.string().optional(),
});

// Internal Connections
export const InternalConnectionsSchema = z.object({
  always: z.array(z.array(z.string())).optional(),
  whenPressed: z.array(z.array(z.string())).optional(),
  whenPowered: z.array(z.array(z.string())).optional(),
  notes: z.string().optional(),
});

// Component Variant
export const ComponentVariantSchema = z.object({
  image: z.string(),
});

// Property Definition
export const PropertyDefinitionSchema = z.object({
  type: z.enum(['select', 'number', 'text']),
  options: z.array(z.string()).optional(),
  default: z.union([z.string(), z.number()]).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

// Component Definition Schema
export const ComponentDefinitionSchema = z.object({
  schemaVersion: z.string().optional(),
  id: z.string(),
  name: z.string(),
  category: z.string(),
  libraryId: z.string().optional(),
  modelId: z.string().optional(),
  variantId: z.string().optional(),
  primaryProtocol: ComponentProtocolSchema.optional(),
  supportedProtocols: z.array(ComponentProtocolSchema).optional(),
  aliases: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  image: z.string(),
  width: z.number(),
  height: z.number(),
  previewPins: z.array(z.string()).optional(),
  functionTypes: z.array(FunctionTypeDefinitionSchema).optional(),
  pins: z.array(PinSchema),
  description: z.string().optional(),
  internalConnections: InternalConnectionsSchema.optional(),
  variants: z.record(ComponentVariantSchema).optional(),
  properties: z.record(PropertyDefinitionSchema).optional(),
  knowledgeRefs: KnowledgeRefsSchema.optional(),
  source: ComponentSourceInfoSchema.optional(),
  netStatus: z.enum(['none', 'partial', 'complete']).optional(),
  generatorHints: z.record(z.union([z.boolean(), z.string(), z.number()])).optional(),
  compatibility: ComponentCompatibilitySchema.optional(),
});

// Catalog Entry Schema (simplified - only essential metadata)
export const ComponentCatalogEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  componentPath: z.string(),
  renderReady: z.boolean(),
  simulationReady: z.boolean(),
  knowledgeReady: z.boolean(),
  visibleInLibrary: z.boolean(),
  librarySection: z.string().optional(),
  librarySectionName: z.string().optional(),
  image: z.string().optional(),
  // Remove redundant fields that should come from component JSON:
  // - libraryId, modelId, defaultVariant
  // - primaryProtocol, supportedProtocols
  // - aliases, tags
  // - previewPins
  // - netStatus
});

// Catalog Schema
export const ComponentCatalogSchema = z.object({
  version: z.string(),
  components: z.array(ComponentCatalogEntrySchema),
});

// Knowledge Frontmatter Schema
export const KnowledgeFrontmatterSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  category: z.string(),
  pins: z.array(z.object({
    name: z.string(),
    function: z.string(),
    notes: z.string(),
  })).optional(),
  common_issues: z.array(z.string()).optional(),
  safety: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  boards: z.array(z.string()).optional(),
  related_components: z.array(z.string()).optional(),
  concepts: z.array(z.string()).optional(),
  libraries: z.array(z.string()).optional(),
  difficulty: z.string().optional(),
  intent: z.string().optional(),
  source_book: z.string().optional(),
  source_files: z.array(z.string()).optional(),
});

// Export type inference
export type ValidatedComponentDefinition = z.infer<typeof ComponentDefinitionSchema>;
export type ValidatedComponentCatalog = z.infer<typeof ComponentCatalogSchema>;
export type ValidatedKnowledgeFrontmatter = z.infer<typeof KnowledgeFrontmatterSchema>;

/**
 * Validate component definition with detailed error reporting
 */
export function validateComponentDefinition(data: unknown): ValidatedComponentDefinition {
  try {
    return ComponentDefinitionSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Validation] Component definition validation failed:', error.errors);
      throw new Error(
        `Invalid component definition: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
    }
    throw error;
  }
}

/**
 * Validate catalog with detailed error reporting
 */
export function validateCatalog(data: unknown): ValidatedComponentCatalog {
  try {
    return ComponentCatalogSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Validation] Catalog validation failed:', error.errors);
      throw new Error(
        `Invalid catalog: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
    }
    throw error;
  }
}

/**
 * Validate knowledge frontmatter with detailed error reporting
 */
export function validateKnowledgeFrontmatter(data: unknown): ValidatedKnowledgeFrontmatter {
  try {
    return KnowledgeFrontmatterSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Validation] Knowledge frontmatter validation failed:', error.errors);
      throw new Error(
        `Invalid knowledge frontmatter: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
    }
    throw error;
  }
}

/**
 * Safe validation that returns result with error flag
 */
export function safeValidateComponentDefinition(data: unknown):
  | { success: true; data: ValidatedComponentDefinition }
  | { success: false; error: string } {
  try {
    const validated = ComponentDefinitionSchema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      };
    }
    return { success: false, error: String(error) };
  }
}
