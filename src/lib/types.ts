import { z } from 'zod';

// ============================================================================
// Configuration Schema
// ============================================================================

export const ConfigSchema = z.object({
  vaultPath: z.string().describe('Absolute path to Obsidian vault'),
  flashcardsFolder: z.string().default('Flashcards').describe('Folder containing flashcard notes'),
  deckPrefix: z.string().default('Rina').describe('Anki deck prefix'),
  ankiConnectUrl: z.string().url().default('http://localhost:8765'),
  cacheRefreshMs: z.number().default(600000).describe('Cache TTL in milliseconds'),
  bulkThreshold: z.number().default(50).describe('Batch size for bulk operations'),
  maxCardsPerNote: z.number().default(500).describe('Max flashcards per markdown file'),
  maxFieldSizeBytes: z.number().default(10240).describe('Max card field size'),
});

export type Config = z.infer<typeof ConfigSchema>;

// ============================================================================
// Flashcard Frontmatter Schema
// ============================================================================

export const FlashcardFrontmatterSchema = z.object({
  anki_deck: z.string().optional(),
  scope: z.enum(['KS3', 'GCSE', 'ALEV']).optional(),
  subject: z.string().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
});

export type FlashcardFrontmatter = z.infer<typeof FlashcardFrontmatterSchema>;

// ============================================================================
// Parsed Flashcard
// ============================================================================

export const FlashcardSchema = z.object({
  uid: z.string().describe('SHA256-based unique ID'),
  front: z.string().describe('Question/prompt'),
  back: z.string().describe('Answer'),
  deck: z.string().describe('Full Anki deck path'),
  tags: z.array(z.string()).default([]),
  sourceFile: z.string().describe('Relative path to source .md file'),
  sourceLine: z.number().describe('Line number in source file'),
  noteId: z.number().optional().describe('Anki note ID if synced'),
});

export type Flashcard = z.infer<typeof FlashcardSchema>;

// ============================================================================
// Sync Result
// ============================================================================

export const SyncResultSchema = z.object({
  created: z.number(),
  updated: z.number(),
  unchanged: z.number(),
  errors: z.array(z.object({
    uid: z.string(),
    error: z.string(),
  })),
  duration: z.number().describe('Milliseconds'),
});

export type SyncResult = z.infer<typeof SyncResultSchema>;

// ============================================================================
// Check Result
// ============================================================================

export const CheckResultSchema = z.object({
  ankiConnected: z.boolean(),
  ankiVersion: z.string().optional(),
  vaultAccessible: z.boolean(),
  flashcardCount: z.number(),
  lastSync: z.string().optional(),
  issues: z.array(z.string()),
});

export type CheckResult = z.infer<typeof CheckResultSchema>;

// ============================================================================
// Tool Input Schemas
// ============================================================================

export const FlashcardParseInputSchema = z.object({
  filePath: z.string().describe('Path to flashcard markdown file'),
});

export const FlashcardSyncInputSchema = z.object({
  dryRun: z.boolean().default(false).describe('Preview changes without syncing'),
  files: z.array(z.string()).optional().describe('Specific files to sync (default: all)'),
});

export const FlashcardListInputSchema = z.object({
  deck: z.string().optional().describe('Filter by deck'),
  subject: z.string().optional().describe('Filter by subject code'),
  limit: z.number().default(100).describe('Max results'),
});

export const FlashcardCheckInputSchema = z.object({
  verbose: z.boolean().default(false),
});

export type FlashcardParseInput = z.infer<typeof FlashcardParseInputSchema>;
export type FlashcardSyncInput = z.infer<typeof FlashcardSyncInputSchema>;
export type FlashcardListInput = z.infer<typeof FlashcardListInputSchema>;
export type FlashcardCheckInput = z.infer<typeof FlashcardCheckInputSchema>;

// ============================================================================
// Subject Code Mapping
// ============================================================================

export const SUBJECT_TO_DECK: Record<string, string> = {
  MATH: 'Mathematics',
  BIOL: 'Biology',
  PHYS: 'Physics',
  CHEM: 'Chemistry',
  ENLA: 'EnglishLanguage',
  ENLI: 'EnglishLiterature',
  HIST: 'History',
  GEOG: 'Geography',
  COMP: 'Computing',
  SPAN: 'Spanish',
  LATN: 'Latin',
  CITI: 'Citizenship',
};
