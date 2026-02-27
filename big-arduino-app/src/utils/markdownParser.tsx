/**
 * Lightweight Markdown Parser
 *
 * Parses a subset of markdown without external dependencies:
 * - Numbered lists (1. item)
 * - Bold text (**bold**)
 */

import React from 'react';

/**
 * Parse markdown text and return React elements
 */
export function parseMarkdown(text: string): React.ReactNode {
  // Split into lines for list processing
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let currentList: string[] = [];
  let listStartNumber = 1;

  const flushList = () => {
    if (currentList.length > 0) {
      result.push(
        <ol key={`list-${result.length}`} className="markdown-list" start={listStartNumber}>
          {currentList.map((item, i) => (
            <li key={i}>{parseBold(item)}</li>
          ))}
        </ol>
      );
      currentList = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for numbered list item (1. , 2. , etc.)
    const listMatch = line.match(/^(\d+)\.\s+(.+)$/);

    if (listMatch) {
      if (currentList.length === 0) {
        listStartNumber = parseInt(listMatch[1], 10);
      }
      currentList.push(listMatch[2]);
    } else {
      // Not a list item - flush any pending list
      flushList();

      // Handle empty lines
      if (line.trim() === '') {
        if (result.length > 0 && i < lines.length - 1) {
          result.push(<br key={`br-${i}`} />);
        }
      } else {
        // Regular text line - parse bold and add
        result.push(
          <span key={`text-${i}`}>
            {parseBold(line)}
            {i < lines.length - 1 && <br />}
          </span>
        );
      }
    }
  }

  // Flush any remaining list
  flushList();

  return <>{result}</>;
}

/**
 * Parse bold text (**bold**) in a string
 */
function parseBold(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match;

  while ((match = boldRegex.exec(text)) !== null) {
    // Add text before the bold
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Add bold text
    parts.push(
      <strong key={`bold-${match.index}`}>{match[1]}</strong>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export default parseMarkdown;
