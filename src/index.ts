#!/usr/bin/env node

/**
 * Obsidian-Anki Bridge MCP Server
 *
 * MCP server for syncing Obsidian flashcards to Anki via AnkiConnect.
 * Communicates over STDIO transport.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

import { type Config, ConfigSchema } from './lib/types.js';
import {
  allTools,
  handleFlashcardParse,
  handleFlashcardSync,
  handleFlashcardList,
  handleFlashcardCheck,
} from './tools/index.js';

/**
 * Load configuration from environment variables
 */
function loadConfig(): Config {
  const rawConfig = {
    vaultPath: process.env.VAULT_PATH || process.env.OBSIDIAN_VAULT_PATH || '',
    flashcardsFolder: process.env.FLASHCARDS_FOLDER || 'Flashcards',
    deckPrefix: process.env.DECK_PREFIX || 'Rina',
    ankiConnectUrl: process.env.ANKI_CONNECT_URL || 'http://localhost:8765',
    cacheRefreshMs: parseInt(process.env.CACHE_REFRESH_MS || '600000', 10),
    bulkThreshold: parseInt(process.env.BULK_THRESHOLD || '50', 10),
    maxCardsPerNote: parseInt(process.env.MAX_CARDS_PER_NOTE || '500', 10),
    maxFieldSizeBytes: parseInt(process.env.MAX_FIELD_SIZE_BYTES || '10240', 10),
  };

  const result = ConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    console.error('Configuration error:', result.error.format());
    console.error('\nRequired environment variable:');
    console.error('  VAULT_PATH - Absolute path to your Obsidian vault');
    process.exit(1);
  }

  if (!result.data.vaultPath) {
    console.error('Error: VAULT_PATH environment variable is required');
    console.error('\nExample:');
    console.error('  VAULT_PATH=/path/to/vault npx obsidian-anki-bridge');
    process.exit(1);
  }

  return result.data;
}

/**
 * Create and configure MCP server
 */
async function main() {
  const config = loadConfig();

  const server = new Server(
    {
      name: 'obsidian-anki-bridge',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list_tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Handle call_tool request
  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      switch (name) {
        case 'flashcard_parse':
          result = await handleFlashcardParse(args, config);
          break;
        case 'flashcard_sync':
          result = await handleFlashcardSync(args, config);
          break;
        case 'flashcard_list':
          result = await handleFlashcardList(args, config);
          break;
        case 'flashcard_check':
          result = await handleFlashcardCheck(args, config);
          break;
        default:
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Unknown tool', name }),
              },
            ],
            isError: true,
          };
      }

      // Parse result to check for errors
      const parsed = JSON.parse(result);
      const isError = 'error' in parsed;

      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
        isError,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Tool execution failed',
              message: error instanceof Error ? error.message : String(error),
            }),
          },
        ],
        isError: true,
      };
    }
  });

  // Connect via STDIO transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Obsidian-Anki Bridge MCP server running');
  console.error(`Vault: ${config.vaultPath}`);
  console.error(`Flashcards folder: ${config.flashcardsFolder}`);
  console.error(`Deck prefix: ${config.deckPrefix}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
