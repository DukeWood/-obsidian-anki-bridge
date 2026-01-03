# Obsidian-Anki Bridge

MCP server for syncing Obsidian flashcards to Anki via AnkiConnect.

## Overview

This MCP server enables Claude Code to manage flashcard synchronization between an Obsidian vault and Anki. It:

- Parses flashcard markdown files from Obsidian
- Syncs cards to Anki while preserving SRS state
- Converts Obsidian wikilinks to deep links
- Provides health checks and listing tools

## Prerequisites

- **Anki Desktop** with [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on installed
- **Node.js** 18+
- **Obsidian vault** with flashcard files

## Installation

```bash
# Clone the repository
git clone https://github.com/DukeWood/-obsidian-anki-bridge.git
cd obsidian-anki-bridge

# Install dependencies
npm install

# Build
npm run build
```

## Configuration

Add to your vault's `.mcp.json`:

```json
{
  "mcpServers": {
    "obsidian-anki-bridge": {
      "command": "node",
      "args": ["/path/to/obsidian-anki-bridge/dist/index.js"],
      "env": {
        "VAULT_PATH": "/path/to/your/obsidian/vault",
        "FLASHCARDS_FOLDER": "Flashcards",
        "DECK_PREFIX": "Rina"
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VAULT_PATH` | Yes | - | Absolute path to Obsidian vault |
| `FLASHCARDS_FOLDER` | No | `Flashcards` | Folder containing flashcard files |
| `DECK_PREFIX` | No | `Rina` | Anki deck name prefix |
| `ANKI_CONNECT_URL` | No | `http://localhost:8765` | AnkiConnect URL |

## Tools

### flashcard_parse

Parse a flashcard file and preview extracted cards.

```
flashcard_parse({ filePath: "Flashcards/BIOL/joints.md" })
```

### flashcard_sync

Sync flashcards to Anki.

```
flashcard_sync({ dryRun: true })  // Preview changes
flashcard_sync({ files: ["Flashcards/MATH/algebra.md"] })  // Sync specific file
flashcard_sync({})  // Sync all
```

### flashcard_list

List flashcards with optional filtering.

```
flashcard_list({ subject: "BIOL", limit: 50 })
flashcard_list({ deck: "KS3" })
```

### flashcard_check

Check system health.

```
flashcard_check({ verbose: true })
```

## Flashcard Formats

### Separator Format (Recommended)

```markdown
---
scope: KS3
subject: BIOL
tags: [joints, skeleton]
---

What type of joint is the knee?

---

A **hinge joint** - allows movement in one plane (flexion/extension).
```

### Callout Format

```markdown
> [!flashcard]
> Q: What type of joint is the knee?
> A: A hinge joint - allows movement in one plane.
```

### Heading Format

```markdown
## What type of joint is the knee?

A hinge joint - allows movement in one plane.
```

## Deck Resolution

Anki deck is determined by frontmatter:

1. `anki_deck: "Custom::Deck"` - explicit override
2. Constructed: `{DECK_PREFIX}::{scope}::{subject}`
   - Example: `Rina::KS3::Biology`

## Development

```bash
# Development mode (auto-reload)
npm run dev

# Type checking
npm run typecheck

# Run tests
npm test
```

## License

MIT
