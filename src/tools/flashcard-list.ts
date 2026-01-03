/**
 * flashcard_list Tool
 *
 * List flashcards in the vault with optional filtering.
 */

import { type Config, FlashcardListInputSchema, SUBJECT_TO_DECK } from '../lib/types.js';
import { parseAllFlashcards } from '../lib/vault-reader.js';

export const flashcardListTool = {
  name: 'flashcard_list',
  description:
    'List flashcards in the Obsidian vault. Filter by deck or subject code.',
  inputSchema: {
    type: 'object',
    properties: {
      deck: {
        type: 'string',
        description: 'Filter by deck name (partial match)',
      },
      subject: {
        type: 'string',
        description: 'Filter by subject code (MATH, BIOL, PHYS, etc.)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 100)',
        default: 100,
      },
    },
  },
};

export async function handleFlashcardList(
  args: unknown,
  config: Config
): Promise<string> {
  const parsed = FlashcardListInputSchema.safeParse(args);

  if (!parsed.success) {
    return JSON.stringify({
      error: 'Invalid input',
      details: parsed.error.format(),
    });
  }

  const { deck, subject, limit } = parsed.data;

  try {
    let flashcards = parseAllFlashcards(config);

    // Apply filters
    if (deck) {
      const deckLower = deck.toLowerCase();
      flashcards = flashcards.filter((c) =>
        c.deck.toLowerCase().includes(deckLower)
      );
    }

    if (subject) {
      const subjectUpper = subject.toUpperCase();
      const deckName = SUBJECT_TO_DECK[subjectUpper] || subjectUpper;
      flashcards = flashcards.filter(
        (c) =>
          c.deck.includes(deckName) ||
          c.tags.some((t) => t.toLowerCase().includes(subject.toLowerCase()))
      );
    }

    // Group by deck
    const deckGroups = flashcards.reduce(
      (acc, card) => {
        if (!acc[card.deck]) {
          acc[card.deck] = [];
        }
        acc[card.deck].push(card);
        return acc;
      },
      {} as Record<string, typeof flashcards>
    );

    // Apply limit and format output
    const limited = flashcards.slice(0, limit);
    const hasMore = flashcards.length > limit;

    return JSON.stringify({
      success: true,
      totalCount: flashcards.length,
      returnedCount: limited.length,
      hasMore,
      deckSummary: Object.fromEntries(
        Object.entries(deckGroups).map(([deck, cards]) => [deck, cards.length])
      ),
      cards: limited.map((c) => ({
        uid: c.uid,
        front: truncate(c.front, 100),
        back: truncate(c.back, 100),
        deck: c.deck,
        tags: c.tags,
        sourceFile: c.sourceFile,
        sourceLine: c.sourceLine,
      })),
    });
  } catch (error) {
    return JSON.stringify({
      error: 'List error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}
