/**
 * Tool Registry
 *
 * Exports all MCP tools and their handlers.
 */

export { flashcardParseTool, handleFlashcardParse } from './flashcard-parse.js';
export { flashcardSyncTool, handleFlashcardSync } from './flashcard-sync.js';
export { flashcardListTool, handleFlashcardList } from './flashcard-list.js';
export { flashcardCheckTool, handleFlashcardCheck } from './flashcard-check.js';

import { flashcardParseTool } from './flashcard-parse.js';
import { flashcardSyncTool } from './flashcard-sync.js';
import { flashcardListTool } from './flashcard-list.js';
import { flashcardCheckTool } from './flashcard-check.js';

/**
 * All available tools for MCP registration
 */
export const allTools = [
  flashcardParseTool,
  flashcardSyncTool,
  flashcardListTool,
  flashcardCheckTool,
];
