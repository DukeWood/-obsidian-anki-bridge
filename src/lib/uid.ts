import { createHash } from 'node:crypto';

/**
 * UID Generation for Flashcards
 *
 * Generates deterministic, unique identifiers for flashcards that:
 * - Remain stable across syncs (same content = same UID)
 * - Are collision-resistant (SHA256)
 * - Can be used to detect content changes
 */

/**
 * Generate a unique ID for a flashcard based on its content
 *
 * Uses SHA256 hash of normalized content to ensure:
 * - Deterministic: Same input always produces same UID
 * - Unique: Different content produces different UIDs
 * - Stable: UID doesn't change unless content changes
 *
 * @param front - Question/prompt text
 * @param back - Answer text
 * @param sourceFile - Relative path to source file (for uniqueness across files)
 * @returns 16-character hex string (truncated SHA256)
 */
export function generateUid(
  front: string,
  back: string,
  sourceFile: string
): string {
  // Normalize content to ensure consistent UIDs
  const normalizedFront = normalizeContent(front);
  const normalizedBack = normalizeContent(back);
  const normalizedPath = sourceFile.toLowerCase().replace(/\\/g, '/');

  // Create deterministic input string
  const input = `${normalizedPath}::${normalizedFront}::${normalizedBack}`;

  // Generate SHA256 hash and truncate to 16 chars
  const hash = createHash('sha256').update(input, 'utf8').digest('hex');
  return hash.substring(0, 16);
}

/**
 * Normalize content for consistent hashing
 *
 * - Trims whitespace
 * - Normalizes line endings
 * - Collapses multiple spaces
 */
function normalizeContent(text: string): string {
  return text
    .trim()
    .replace(/\r\n/g, '\n')       // Normalize line endings
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')       // Collapse horizontal whitespace
    .replace(/\n+/g, '\n');        // Collapse multiple newlines
}

/**
 * Generate a content hash for change detection
 * Returns full SHA256 hash for more precise comparison
 */
export function generateContentHash(content: string): string {
  const normalized = normalizeContent(content);
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Validate UID format
 */
export function isValidUid(uid: string): boolean {
  return /^[a-f0-9]{16}$/.test(uid);
}
