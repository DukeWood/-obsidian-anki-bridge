# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP server that syncs flashcards from an Obsidian vault to Anki via AnkiConnect. It parses markdown flashcard files, generates stable UIDs for tracking, converts Obsidian syntax (wikilinks, images) to Anki-compatible HTML, and creates bidirectional deep links.

## Commands

```bash
npm run build      # Compile TypeScript to dist/
npm run dev        # Development with auto-reload (tsx watch)
npm test           # Run tests with vitest
npm run typecheck  # Type check without emitting
npm run lint       # ESLint
```

## Architecture

```
src/
├── index.ts              # MCP server entry point (STDIO transport)
├── tools/                # MCP tool handlers
│   ├── flashcard-parse   # Parse single file, preview cards
│   ├── flashcard-sync    # Sync to Anki (dry run or live)
│   ├── flashcard-list    # List cards with filtering
│   └── flashcard-check   # Health check (Anki connection, vault access)
└── lib/
    ├── types.ts          # Zod schemas for config, flashcards, inputs
    ├── vault-reader.ts   # Parse markdown files, extract cards
    ├── anki-client.ts    # AnkiConnect API wrapper
    ├── wikilinks.ts      # Convert [[wikilinks]] → obsidian:// deep links
    └── uid.ts            # Deterministic SHA256-based card UIDs
```

**Data Flow:** Markdown files → `vault-reader.ts` parses frontmatter + content → `uid.ts` generates stable UIDs → `wikilinks.ts` converts Obsidian syntax → `anki-client.ts` syncs to Anki via HTTP

## Key Patterns

**UID Generation:** Cards are identified by truncated SHA256 hash of `{sourceFile}::{front}::{back}`. Stored as Anki tags (`obsidian-uid::abc123...`) to enable update-in-place without duplicates.

**Deck Resolution:** Priority order:
1. Explicit `anki_deck` frontmatter
2. Constructed: `{DECK_PREFIX}::{scope}::{subject}` (e.g., `Rina::KS3::Biology`)
3. Fallback: `{DECK_PREFIX}` only

**Flashcard Formats:** Parser tries formats in order:
1. Separator (`---` between front/back)
2. Callout (`> [!flashcard]` with `Q:` and `A:`)
3. Heading (H2 = question, content = answer)

**Note Model:** Creates custom Anki note type `ObsidianFlashcard` with fields: Front, Back, SourceLink

## Configuration

Environment variables (set via `.mcp.json`):
- `VAULT_PATH` (required): Absolute path to Obsidian vault
- `FLASHCARDS_FOLDER`: Subfolder containing flashcard files (default: `Flashcards`)
- `DECK_PREFIX`: Anki deck prefix (default: `Rina`)
- `ANKI_CONNECT_URL`: AnkiConnect endpoint (default: `http://localhost:8765`)

## Testing Notes

Requires Anki Desktop running with AnkiConnect add-on for integration tests. Use `flashcard_check` tool to verify connectivity.
