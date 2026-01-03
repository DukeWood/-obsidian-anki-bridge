/**
 * Wikilink handling for Obsidian → Anki conversion
 *
 * Converts Obsidian-style [[wikilinks]] to clickable deep links in Anki cards.
 * Uses obsidian:// protocol for native app integration.
 * Also converts Markdown to HTML for proper Anki rendering.
 */

import { marked } from 'marked';

// Configure marked for safe HTML output
marked.setOptions({
  breaks: true,  // Convert \n to <br>
  gfm: true,     // GitHub Flavored Markdown
});

/**
 * HTML entity escaping to prevent XSS in Anki cards
 */
export function escapeHtml(str: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, (c) => entities[c] || c);
}

/**
 * Convert Obsidian wikilinks to HTML anchor tags with obsidian:// deep links
 *
 * Handles:
 * - Basic: [[Note]] → <a href="obsidian://open?vault=X&file=Note">Note</a>
 * - Aliased: [[Note|Display]] → <a href="...">Display</a>
 * - Headings: [[Note#Section]] → <a href="...">Section</a>
 * - Combined: [[Note#Section|Custom]] → <a href="...">Custom</a>
 *
 * @param text - Markdown text containing wikilinks
 * @param vaultName - Obsidian vault name for deep links
 * @returns Text with wikilinks converted to HTML anchors
 */
export function convertWikilinks(text: string, vaultName: string): string {
  // Pattern: [[target]] or [[target|display]]
  const wikilinkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

  return text.replace(wikilinkPattern, (_, target: string, display?: string) => {
    // Determine display text:
    // 1. Explicit alias: [[Note|Display]] → "Display"
    // 2. Heading reference: [[Note#Section]] → "Section"
    // 3. Default: [[Note]] → "Note"
    let label: string;
    if (display) {
      label = display;
    } else if (target.includes('#')) {
      // Extract text after last # for heading references
      const parts = target.split('#');
      label = parts[parts.length - 1];
    } else {
      label = target;
    }

    // Build obsidian:// deep link URL
    const encodedVault = encodeURIComponent(vaultName);
    const encodedFile = encodeURIComponent(target);
    const url = `obsidian://open?vault=${encodedVault}&file=${encodedFile}`;

    // Return HTML anchor with escaped label to prevent XSS
    return `<a href="${url}">${escapeHtml(label)}</a>`;
  });
}

/**
 * Convert markdown image syntax to HTML img tags
 * Handles both local vault images and external URLs
 */
export function convertImages(text: string, vaultName: string, vaultPath: string): string {
  // Obsidian image embed: ![[image.png]]
  const obsidianImagePattern = /!\[\[([^\]]+)\]\]/g;

  return text.replace(obsidianImagePattern, (_, imagePath: string) => {
    // For local images, we'd need to either:
    // 1. Use file:// protocol (limited support)
    // 2. Copy to Anki media folder
    // For MVP, we'll generate a placeholder with the path
    const escaped = escapeHtml(imagePath);
    return `<img src="${escaped}" alt="${escaped}" style="max-width: 100%;">`;
  });
}

/**
 * Convert Obsidian callouts to styled HTML divs
 * > [!tip] Title → <div class="callout callout-tip"><strong>Title</strong>...</div>
 */
export function convertCallouts(text: string): string {
  // Pattern: > [!type] optional title followed by content lines starting with >
  const calloutPattern = /^>\s*\[!(\w+)\]\s*(.*)$/gm;

  return text.replace(calloutPattern, (_, type: string, title: string) => {
    const typeClass = type.toLowerCase();
    const titleHtml = title ? `<strong>${escapeHtml(title)}</strong><br>` : '';
    return `<div class="callout callout-${typeClass}">${titleHtml}`;
  });
}

/**
 * Convert Markdown to HTML using marked
 */
export function markdownToHtml(text: string): string {
  // marked.parse can return string or Promise<string>, we use sync mode
  const result = marked.parse(text);
  return typeof result === 'string' ? result : text;
}

/**
 * Process all Obsidian-specific syntax in flashcard content
 * Order matters: wikilinks → images → callouts → markdown
 */
export function processObsidianSyntax(
  text: string,
  vaultName: string,
  vaultPath: string
): string {
  let result = text;

  // 1. Convert Obsidian wikilinks before markdown processing
  result = convertWikilinks(result, vaultName);

  // 2. Convert Obsidian image embeds
  result = convertImages(result, vaultName, vaultPath);

  // 3. Convert Obsidian callouts (before markdown, as they use > syntax)
  result = convertCallouts(result);

  // 4. Convert remaining Markdown to HTML
  result = markdownToHtml(result);

  return result;
}
