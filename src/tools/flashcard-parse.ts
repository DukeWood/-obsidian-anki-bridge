/**
 * flashcard_parse Tool
 *
 * Parse a single flashcard markdown file and return extracted cards.
 * Used for previewing what will be synced.
 */

import { join, isAbsolute } from 'node:path';
import { existsSync } from 'node:fs';
import { type Config, FlashcardParseInputSchema } from '../lib/types.js';
import { parseFlashcardFile } from '../lib/vault-reader.js';

export const flashcardParseTool = {
  name: 'flashcard_parse',
  description:
    'Parse a flashcard markdown file and return extracted cards. Use this to preview what will be synced to Anki.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description:
          'Path to flashcard markdown file (relative to vault or absolute)',
      },
    },
    required: ['filePath'],
  },
};

export async function handleFlashcardParse(
  args: unknown,
  config: Config
): Promise<string> {
  const parsed = FlashcardParseInputSchema.safeParse(args);

  if (!parsed.success) {
    return JSON.stringify({
      error: 'Invalid input',
      details: parsed.error.format(),
    });
  }

  const { filePath } = parsed.data;

  // Resolve path
  const fullPath = isAbsolute(filePath)
    ? filePath
    : join(config.vaultPath, filePath);

  // Validate path is within vault
  if (!fullPath.startsWith(config.vaultPath)) {
    return JSON.stringify({
      error: 'Security error',
      message: 'File path must be within the configured vault',
    });
  }

  // Check file exists
  if (!existsSync(fullPath)) {
    return JSON.stringify({
      error: 'File not found',
      path: filePath,
    });
  }

  try {
    const flashcards = parseFlashcardFile(fullPath, config);

    return JSON.stringify({
      success: true,
      file: filePath,
      cardCount: flashcards.length,
      cards: flashcards.map((card) => ({
        uid: card.uid,
        front: truncate(card.front, 100),
        back: truncate(card.back, 100),
        deck: card.deck,
        tags: card.tags,
        sourceLine: card.sourceLine,
      })),
    });
  } catch (error) {
    return JSON.stringify({
      error: 'Parse error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}
