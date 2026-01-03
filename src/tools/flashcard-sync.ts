/**
 * flashcard_sync Tool
 *
 * Sync flashcards from Obsidian vault to Anki.
 * Creates new cards, updates changed ones, preserves SRS state.
 */

import { join, isAbsolute, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { type Config, FlashcardSyncInputSchema, type Flashcard } from '../lib/types.js';
import { parseFlashcardFile, findFlashcardFiles } from '../lib/vault-reader.js';
import { AnkiClient } from '../lib/anki-client.js';

export const flashcardSyncTool = {
  name: 'flashcard_sync',
  description:
    'Sync flashcards from Obsidian vault to Anki. Use dryRun=true to preview changes without syncing.',
  inputSchema: {
    type: 'object',
    properties: {
      dryRun: {
        type: 'boolean',
        description: 'Preview changes without actually syncing (default: false)',
        default: false,
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific files to sync (default: all flashcard files)',
      },
    },
  },
};

export async function handleFlashcardSync(
  args: unknown,
  config: Config
): Promise<string> {
  const parsed = FlashcardSyncInputSchema.safeParse(args);

  if (!parsed.success) {
    return JSON.stringify({
      error: 'Invalid input',
      details: parsed.error.format(),
    });
  }

  const { dryRun, files } = parsed.data;

  // Collect flashcards to sync
  let allCards: Flashcard[] = [];

  if (files && files.length > 0) {
    // Sync specific files
    for (const filePath of files) {
      const fullPath = isAbsolute(filePath)
        ? filePath
        : join(config.vaultPath, filePath);

      // Security check
      if (!fullPath.startsWith(config.vaultPath)) {
        return JSON.stringify({
          error: 'Security error',
          message: `File path must be within vault: ${filePath}`,
        });
      }

      if (!existsSync(fullPath)) {
        return JSON.stringify({
          error: 'File not found',
          path: filePath,
        });
      }

      try {
        const cards = parseFlashcardFile(fullPath, config);
        allCards.push(...cards);
      } catch (error) {
        return JSON.stringify({
          error: 'Parse error',
          file: filePath,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } else {
    // Sync all flashcard files
    const flashcardFiles = findFlashcardFiles(config);

    for (const file of flashcardFiles) {
      try {
        const cards = parseFlashcardFile(file, config);
        allCards.push(...cards);
      } catch (error) {
        console.error(`Error parsing ${file}:`, error);
      }
    }
  }

  // Check limits
  if (allCards.length > config.maxCardsPerNote * 100) {
    return JSON.stringify({
      error: 'Too many cards',
      message: `Found ${allCards.length} cards, max is ${config.maxCardsPerNote * 100}`,
    });
  }

  // Group by deck for summary
  const deckSummary = allCards.reduce(
    (acc, card) => {
      acc[card.deck] = (acc[card.deck] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  if (dryRun) {
    return JSON.stringify({
      success: true,
      dryRun: true,
      totalCards: allCards.length,
      deckSummary,
      sampleCards: allCards.slice(0, 5).map((c) => ({
        uid: c.uid,
        front: truncate(c.front, 80),
        deck: c.deck,
        sourceFile: c.sourceFile,
      })),
    });
  }

  // Connect to Anki and sync
  const anki = new AnkiClient(config.ankiConnectUrl);

  // Check connection first
  const pingResult = await anki.ping();
  if (!pingResult.connected) {
    return JSON.stringify({
      error: 'Anki not connected',
      message:
        'Cannot connect to AnkiConnect. Make sure Anki is running with AnkiConnect installed.',
    });
  }

  // Perform sync
  const vaultName = basename(config.vaultPath);
  const result = await anki.syncCards(allCards, vaultName);

  return JSON.stringify({
    success: true,
    ...result,
    deckSummary,
  });
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}
