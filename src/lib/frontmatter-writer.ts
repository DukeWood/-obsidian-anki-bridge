/**
 * Frontmatter Writer
 *
 * Updates frontmatter in Obsidian markdown files while preserving content.
 * Used to write back Anki note IDs after sync.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import matter from 'gray-matter';

/**
 * Sync state stored in frontmatter
 */
export interface AnkiSyncState {
  /** Map of card UID to Anki note ID */
  note_ids: Record<string, number>;
  /** Last successful sync timestamp */
  last_synced: string;
  /** Number of cards synced */
  card_count: number;
}

/**
 * Update the anki_sync field in a file's frontmatter
 *
 * @param filePath - Absolute path to markdown file
 * @param syncState - Sync state to write
 */
export function writeSyncState(filePath: string, syncState: AnkiSyncState): void {
  const content = readFileSync(filePath, 'utf-8');
  const { data: frontmatter, content: body } = matter(content);

  // Update or create anki_sync field
  frontmatter.anki_sync = {
    note_ids: syncState.note_ids,
    last_synced: syncState.last_synced,
    card_count: syncState.card_count,
  };

  // Also update the file's `updated` field
  frontmatter.updated = new Date().toISOString().split('T')[0];

  // Stringify back to markdown
  const updated = matter.stringify(body, frontmatter);
  writeFileSync(filePath, updated, 'utf-8');
}

/**
 * Read existing sync state from frontmatter
 *
 * @param filePath - Absolute path to markdown file
 * @returns Sync state or null if not synced
 */
export function readSyncState(filePath: string): AnkiSyncState | null {
  const content = readFileSync(filePath, 'utf-8');
  const { data: frontmatter } = matter(content);

  if (!frontmatter.anki_sync) {
    return null;
  }

  return {
    note_ids: frontmatter.anki_sync.note_ids || {},
    last_synced: frontmatter.anki_sync.last_synced || '',
    card_count: frontmatter.anki_sync.card_count || 0,
  };
}

/**
 * Merge new sync results with existing state
 *
 * @param existing - Existing sync state (or null)
 * @param newNoteIds - Map of UID to note ID from this sync
 * @returns Merged sync state
 */
export function mergeSyncState(
  existing: AnkiSyncState | null,
  newNoteIds: Record<string, number>
): AnkiSyncState {
  const existingIds = existing?.note_ids || {};

  return {
    note_ids: { ...existingIds, ...newNoteIds },
    last_synced: new Date().toISOString(),
    card_count: Object.keys({ ...existingIds, ...newNoteIds }).length,
  };
}

/**
 * Update sync state for a single file after sync
 *
 * @param filePath - Absolute path to markdown file
 * @param newNoteIds - Map of UID to Anki note ID
 */
export function updateFileSyncState(
  filePath: string,
  newNoteIds: Record<string, number>
): void {
  const existing = readSyncState(filePath);
  const merged = mergeSyncState(existing, newNoteIds);
  writeSyncState(filePath, merged);
}
