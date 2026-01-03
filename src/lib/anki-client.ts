/**
 * AnkiConnect API Client
 *
 * Wrapper around yanki-connect for communicating with Anki desktop app.
 * AnkiConnect runs on localhost:8765 by default (no auth required).
 */

import { type Flashcard, type SyncResult } from './types.js';

// AnkiConnect API types (subset we use)
interface AnkiConnectRequest {
  action: string;
  version: number;
  params?: Record<string, unknown>;
}

interface AnkiConnectResponse<T = unknown> {
  result: T;
  error: string | null;
}

interface AnkiNote {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags: string[];
  options?: {
    allowDuplicate: boolean;
    duplicateScope: string;
  };
}

/**
 * AnkiConnect client for flashcard synchronization
 */
export class AnkiClient {
  private url: string;
  private version = 6;

  constructor(url = 'http://localhost:8765') {
    this.url = url;
  }

  /**
   * Send request to AnkiConnect API
   */
  private async invoke<T>(action: string, params?: Record<string, unknown>): Promise<T> {
    const request: AnkiConnectRequest = {
      action,
      version: this.version,
      params,
    };

    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`AnkiConnect HTTP error: ${response.status}`);
    }

    const data = (await response.json()) as AnkiConnectResponse<T>;

    if (data.error) {
      throw new Error(`AnkiConnect error: ${data.error}`);
    }

    return data.result;
  }

  /**
   * Check if AnkiConnect is accessible and get version
   */
  async ping(): Promise<{ connected: boolean; version?: string }> {
    try {
      const version = await this.invoke<number>('version');
      return { connected: true, version: String(version) };
    } catch {
      return { connected: false };
    }
  }

  /**
   * Get or create a deck
   */
  async ensureDeck(deckName: string): Promise<void> {
    await this.invoke('createDeck', { deck: deckName });
  }

  /**
   * Check if note model exists, create if not
   */
  async ensureNoteModel(): Promise<void> {
    const models = await this.invoke<string[]>('modelNames');

    if (!models.includes('ObsidianFlashcard')) {
      await this.invoke('createModel', {
        modelName: 'ObsidianFlashcard',
        inOrderFields: ['Front', 'Back', 'SourceLink'],
        css: `
          .card {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 18px;
            text-align: center;
            color: #333;
            background-color: #fff;
            padding: 20px;
          }
          .source-link {
            font-size: 12px;
            color: #888;
            margin-top: 20px;
          }
          .source-link a {
            color: #666;
            text-decoration: none;
          }
          .source-link a:hover {
            text-decoration: underline;
          }
        `,
        cardTemplates: [
          {
            Name: 'Card 1',
            Front: '{{Front}}',
            Back: `{{FrontSide}}<hr id="answer">{{Back}}<div class="source-link">{{SourceLink}}</div>`,
          },
        ],
      });
    }
  }

  /**
   * Find note by our custom UID tag
   */
  async findNoteByUid(uid: string): Promise<number | null> {
    const noteIds = await this.invoke<number[]>('findNotes', {
      query: `tag:obsidian-uid::${uid}`,
    });
    return noteIds.length > 0 ? noteIds[0] : null;
  }

  /**
   * Add a new note to Anki
   */
  async addNote(card: Flashcard, vaultName: string): Promise<number> {
    const sourceLink = this.buildSourceLink(card, vaultName);

    const note: AnkiNote = {
      deckName: card.deck,
      modelName: 'ObsidianFlashcard',
      fields: {
        Front: card.front,
        Back: card.back,
        SourceLink: sourceLink,
      },
      tags: [...card.tags, `obsidian-uid::${card.uid}`],
      options: {
        allowDuplicate: false,
        duplicateScope: 'deck',
      },
    };

    return await this.invoke<number>('addNote', { note });
  }

  /**
   * Update an existing note
   */
  async updateNote(noteId: number, card: Flashcard, vaultName: string): Promise<void> {
    const sourceLink = this.buildSourceLink(card, vaultName);

    await this.invoke('updateNoteFields', {
      note: {
        id: noteId,
        fields: {
          Front: card.front,
          Back: card.back,
          SourceLink: sourceLink,
        },
      },
    });

    // Update tags
    const existingTags = await this.invoke<string[]>('getNoteTags', { note: noteId });
    const newTags = [...card.tags, `obsidian-uid::${card.uid}`];

    // Remove old tags that aren't in new set
    for (const tag of existingTags) {
      if (!newTags.includes(tag) && !tag.startsWith('obsidian-uid::')) {
        await this.invoke('removeTags', { notes: [noteId], tags: tag });
      }
    }

    // Add new tags
    await this.invoke('addTags', { notes: [noteId], tags: newTags.join(' ') });
  }

  /**
   * Build deep link back to Obsidian source
   */
  private buildSourceLink(card: Flashcard, vaultName: string): string {
    const encodedVault = encodeURIComponent(vaultName);
    const encodedFile = encodeURIComponent(card.sourceFile);
    const url = `obsidian://open?vault=${encodedVault}&file=${encodedFile}&line=${card.sourceLine}`;
    return `<a href="${url}">View in Obsidian</a>`;
  }

  /**
   * Sync multiple flashcards to Anki
   * Returns note ID mappings for write-back to frontmatter
   */
  async syncCards(cards: Flashcard[], vaultName: string): Promise<SyncResult> {
    const startTime = Date.now();
    const noteIds: Record<string, number> = {};
    const fileToUids: Record<string, string[]> = {};
    const result: SyncResult = {
      created: 0,
      updated: 0,
      unchanged: 0,
      errors: [],
      duration: 0,
      noteIds,
      fileToUids,
    };

    // Ensure model exists
    await this.ensureNoteModel();

    // Collect unique decks and ensure they exist
    const decks = new Set(cards.map((c) => c.deck));
    for (const deck of decks) {
      await this.ensureDeck(deck);
    }

    // Process each card
    for (const card of cards) {
      try {
        const existingNoteId = await this.findNoteByUid(card.uid);
        let noteId: number;

        if (existingNoteId) {
          // Update existing note
          await this.updateNote(existingNoteId, card, vaultName);
          noteId = existingNoteId;
          result.updated++;
        } else {
          // Create new note - addNote returns the note ID
          noteId = await this.addNote(card, vaultName);
          result.created++;
        }

        // Track UID → noteId mapping
        noteIds[card.uid] = noteId;

        // Track which UIDs came from which file (for write-back)
        if (!fileToUids[card.sourceFile]) {
          fileToUids[card.sourceFile] = [];
        }
        fileToUids[card.sourceFile].push(card.uid);
      } catch (error) {
        result.errors.push({
          uid: card.uid,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    result.duration = Date.now() - startTime;
    return result;
  }
}
