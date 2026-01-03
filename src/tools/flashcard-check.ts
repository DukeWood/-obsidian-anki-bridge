/**
 * flashcard_check Tool
 *
 * Check system health: AnkiConnect connection, vault access, and counts.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { type Config, FlashcardCheckInputSchema, type CheckResult } from '../lib/types.js';
import { findFlashcardFiles, parseAllFlashcards } from '../lib/vault-reader.js';
import { AnkiClient } from '../lib/anki-client.js';

export const flashcardCheckTool = {
  name: 'flashcard_check',
  description:
    'Check system health: AnkiConnect connection, vault access, flashcard counts.',
  inputSchema: {
    type: 'object',
    properties: {
      verbose: {
        type: 'boolean',
        description: 'Include detailed information (default: false)',
        default: false,
      },
    },
  },
};

export async function handleFlashcardCheck(
  args: unknown,
  config: Config
): Promise<string> {
  const parsed = FlashcardCheckInputSchema.safeParse(args);

  if (!parsed.success) {
    return JSON.stringify({
      error: 'Invalid input',
      details: parsed.error.format(),
    });
  }

  const { verbose } = parsed.data;
  const issues: string[] = [];

  // Check vault accessibility
  const vaultAccessible = existsSync(config.vaultPath);
  if (!vaultAccessible) {
    issues.push(`Vault path not accessible: ${config.vaultPath}`);
  }

  // Check flashcards folder
  const flashcardsDir = join(config.vaultPath, config.flashcardsFolder);
  const flashcardsFolderExists = existsSync(flashcardsDir);
  if (!flashcardsFolderExists) {
    issues.push(`Flashcards folder not found: ${config.flashcardsFolder}`);
  }

  // Count flashcard files and cards
  let flashcardFileCount = 0;
  let flashcardCount = 0;
  let deckSummary: Record<string, number> = {};

  if (vaultAccessible && flashcardsFolderExists) {
    try {
      const files = findFlashcardFiles(config);
      flashcardFileCount = files.length;

      const allCards = parseAllFlashcards(config);
      flashcardCount = allCards.length;

      // Group by deck
      deckSummary = allCards.reduce(
        (acc, card) => {
          acc[card.deck] = (acc[card.deck] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
    } catch (error) {
      issues.push(`Error reading flashcards: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Check AnkiConnect
  const anki = new AnkiClient(config.ankiConnectUrl);
  const pingResult = await anki.ping();

  if (!pingResult.connected) {
    issues.push('AnkiConnect not accessible - ensure Anki is running with AnkiConnect add-on');
  }

  const result: CheckResult & {
    flashcardFileCount?: number;
    deckSummary?: Record<string, number>;
    config?: Partial<Config>;
  } = {
    ankiConnected: pingResult.connected,
    ankiVersion: pingResult.version,
    vaultAccessible,
    flashcardCount,
    issues,
  };

  if (verbose) {
    result.flashcardFileCount = flashcardFileCount;
    result.deckSummary = deckSummary;
    result.config = {
      vaultPath: config.vaultPath,
      flashcardsFolder: config.flashcardsFolder,
      deckPrefix: config.deckPrefix,
      ankiConnectUrl: config.ankiConnectUrl,
    };
  }

  return JSON.stringify({
    success: issues.length === 0,
    ...result,
  });
}
