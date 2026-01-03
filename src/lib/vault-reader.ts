/**
 * Obsidian Vault Reader
 *
 * Reads and parses flashcard markdown files from an Obsidian vault.
 * Extracts frontmatter metadata and flashcard content.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';
import matter from 'gray-matter';
import {
  type Config,
  type Flashcard,
  type FlashcardFrontmatter,
  FlashcardFrontmatterSchema,
  SUBJECT_TO_DECK,
} from './types.js';
import { generateUid } from './uid.js';
import { processObsidianSyntax } from './wikilinks.js';

/**
 * Parse a single flashcard markdown file
 */
export function parseFlashcardFile(
  filePath: string,
  config: Config
): Flashcard[] {
  const content = readFileSync(filePath, 'utf-8');
  const { data: rawFrontmatter, content: body } = matter(content);

  // Validate frontmatter
  const frontmatterResult = FlashcardFrontmatterSchema.safeParse(rawFrontmatter);
  const frontmatter: FlashcardFrontmatter = frontmatterResult.success
    ? frontmatterResult.data
    : {};

  // Determine deck from frontmatter or derive from path
  const deck = resolveDeck(filePath, frontmatter, config);

  // Get vault name from path
  const vaultName = basename(config.vaultPath);

  // Parse flashcards from body
  const flashcards = parseFlashcardContent(body, filePath, config, deck, frontmatter, vaultName);

  return flashcards;
}

/**
 * Resolve the Anki deck name for a file
 *
 * Priority:
 * 1. Explicit anki_deck in frontmatter
 * 2. Constructed from: {deckPrefix}::{scope}::{subject}
 * 3. Fallback to deckPrefix only
 */
function resolveDeck(
  filePath: string,
  frontmatter: FlashcardFrontmatter,
  config: Config
): string {
  // 1. Explicit deck override
  if (frontmatter.anki_deck) {
    return frontmatter.anki_deck;
  }

  // 2. Construct from frontmatter fields
  const parts: string[] = [config.deckPrefix];

  if (frontmatter.scope) {
    parts.push(frontmatter.scope);
  }

  if (frontmatter.subject) {
    const deckName = SUBJECT_TO_DECK[frontmatter.subject] || frontmatter.subject;
    parts.push(deckName);
  }

  return parts.join('::');
}

/**
 * Parse flashcard content from markdown body
 *
 * Supports multiple formats:
 * 1. Heading-based: ## Question followed by answer
 * 2. Separator-based: Front --- Back (horizontal rule)
 * 3. Callout-based: > [!flashcard] with Q: and A: lines
 */
function parseFlashcardContent(
  body: string,
  filePath: string,
  config: Config,
  deck: string,
  frontmatter: FlashcardFrontmatter,
  vaultName: string
): Flashcard[] {
  const flashcards: Flashcard[] = [];
  const relativePath = relative(config.vaultPath, filePath);
  const lines = body.split('\n');

  // Get tags from frontmatter
  const baseTags = normalizeTagsArray(frontmatter.tags);

  // Track line numbers for source linking
  let currentLine = getContentStartLine(filePath);

  // Try separator-based parsing first (most explicit)
  const separatorCards = parseSeparatorFormat(lines, currentLine);

  if (separatorCards.length > 0) {
    for (const { front, back, line } of separatorCards) {
      const processedFront = processObsidianSyntax(front, vaultName, config.vaultPath);
      const processedBack = processObsidianSyntax(back, vaultName, config.vaultPath);

      flashcards.push({
        uid: generateUid(front, back, relativePath),
        front: processedFront,
        back: processedBack,
        deck,
        tags: baseTags,
        sourceFile: relativePath,
        sourceLine: line,
      });
    }
    return flashcards;
  }

  // Try callout-based parsing
  const calloutCards = parseCalloutFormat(lines, currentLine);

  if (calloutCards.length > 0) {
    for (const { front, back, line } of calloutCards) {
      const processedFront = processObsidianSyntax(front, vaultName, config.vaultPath);
      const processedBack = processObsidianSyntax(back, vaultName, config.vaultPath);

      flashcards.push({
        uid: generateUid(front, back, relativePath),
        front: processedFront,
        back: processedBack,
        deck,
        tags: baseTags,
        sourceFile: relativePath,
        sourceLine: line,
      });
    }
    return flashcards;
  }

  // Fallback: heading-based parsing
  const headingCards = parseHeadingFormat(lines, currentLine);

  for (const { front, back, line } of headingCards) {
    const processedFront = processObsidianSyntax(front, vaultName, config.vaultPath);
    const processedBack = processObsidianSyntax(back, vaultName, config.vaultPath);

    flashcards.push({
      uid: generateUid(front, back, relativePath),
      front: processedFront,
      back: processedBack,
      deck,
      tags: baseTags,
      sourceFile: relativePath,
      sourceLine: line,
    });
  }

  return flashcards;
}

interface RawCard {
  front: string;
  back: string;
  line: number;
}

/**
 * Parse separator format: Front --- Back
 */
function parseSeparatorFormat(lines: string[], startLine: number): RawCard[] {
  const cards: RawCard[] = [];
  let i = 0;

  while (i < lines.length) {
    // Look for horizontal rule separator
    if (/^---+$/.test(lines[i].trim()) && i > 0) {
      // Collect front (lines before ---)
      let frontStart = i - 1;
      while (frontStart > 0 && lines[frontStart - 1].trim() !== '' && !/^---+$/.test(lines[frontStart - 1].trim())) {
        frontStart--;
      }
      const front = lines.slice(frontStart, i).join('\n').trim();

      // Collect back (lines after ---)
      let backEnd = i + 1;
      while (backEnd < lines.length && lines[backEnd].trim() !== '' && !/^---+$/.test(lines[backEnd].trim())) {
        backEnd++;
      }
      const back = lines.slice(i + 1, backEnd).join('\n').trim();

      if (front && back) {
        cards.push({
          front,
          back,
          line: startLine + frontStart,
        });
      }

      i = backEnd;
    } else {
      i++;
    }
  }

  return cards;
}

/**
 * Parse callout format: > [!flashcard] with Q: and A:
 */
function parseCalloutFormat(lines: string[], startLine: number): RawCard[] {
  const cards: RawCard[] = [];
  let i = 0;

  while (i < lines.length) {
    // Look for flashcard callout
    if (/^>\s*\[!flashcard\]/i.test(lines[i])) {
      const cardStartLine = startLine + i;
      let front = '';
      let back = '';
      let inFront = false;
      let inBack = false;

      i++; // Move past callout header

      // Parse callout content
      while (i < lines.length && lines[i].startsWith('>')) {
        const line = lines[i].substring(1).trim();

        if (/^Q:/i.test(line)) {
          inFront = true;
          inBack = false;
          front = line.substring(2).trim();
        } else if (/^A:/i.test(line)) {
          inFront = false;
          inBack = true;
          back = line.substring(2).trim();
        } else if (inFront) {
          front += '\n' + line;
        } else if (inBack) {
          back += '\n' + line;
        }

        i++;
      }

      if (front && back) {
        cards.push({
          front: front.trim(),
          back: back.trim(),
          line: cardStartLine,
        });
      }
    } else {
      i++;
    }
  }

  return cards;
}

/**
 * Parse heading format: ## Question followed by answer content
 */
function parseHeadingFormat(lines: string[], startLine: number): RawCard[] {
  const cards: RawCard[] = [];
  let i = 0;

  while (i < lines.length) {
    // Look for H2 heading (potential question)
    const headingMatch = lines[i].match(/^##\s+(.+)$/);

    if (headingMatch) {
      const front = headingMatch[1].trim();
      const cardStartLine = startLine + i;
      let backLines: string[] = [];

      i++; // Move past heading

      // Collect answer content until next heading or end
      while (i < lines.length && !lines[i].startsWith('#')) {
        backLines.push(lines[i]);
        i++;
      }

      const back = backLines.join('\n').trim();

      if (front && back) {
        cards.push({
          front,
          back,
          line: cardStartLine,
        });
      }
    } else {
      i++;
    }
  }

  return cards;
}

/**
 * Get the line number where content starts (after frontmatter)
 */
function getContentStartLine(filePath: string): number {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  if (lines[0] !== '---') {
    return 1;
  }

  // Find closing ---
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      return i + 2; // Line after closing ---
    }
  }

  return 1;
}

/**
 * Normalize tags to array format
 */
function normalizeTagsArray(tags: string | string[] | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return tags.split(/[,\s]+/).filter(Boolean);
}

/**
 * Find all flashcard files in vault
 */
export function findFlashcardFiles(config: Config): string[] {
  const flashcardsDir = join(config.vaultPath, config.flashcardsFolder);

  if (!existsSync(flashcardsDir)) {
    return [];
  }

  return walkDirectory(flashcardsDir).filter(
    (f) => extname(f).toLowerCase() === '.md'
  );
}

/**
 * Recursively walk directory and collect file paths
 */
function walkDirectory(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...walkDirectory(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Parse all flashcard files in vault
 */
export function parseAllFlashcards(config: Config): Flashcard[] {
  const files = findFlashcardFiles(config);
  const allCards: Flashcard[] = [];

  for (const file of files) {
    try {
      const cards = parseFlashcardFile(file, config);
      allCards.push(...cards);
    } catch (error) {
      console.error(`Error parsing ${file}:`, error);
    }
  }

  return allCards;
}
