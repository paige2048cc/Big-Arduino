/**
 * ClickableIssue Component
 *
 * Displays a clickable issue card in AI responses.
 * When clicked, highlights the affected component/wire on the canvas.
 */

import React from 'react';
import { AlertCircle, AlertTriangle, Lightbulb, Info, Eye } from 'lucide-react';
import type { HighlightSeverity } from '../../types/chat';
import './ClickableIssue.css';

export interface IssueData {
  id: string;
  number: number;
  severity: HighlightSeverity;
  title: string;
  description: string;
  fix?: string;
  affectedIds: string[];
}

interface ClickableIssueProps {
  issue: IssueData;
  onView: (affectedIds: string[]) => void;
}

/**
 * Get icon based on severity
 */
function getSeverityIcon(severity: HighlightSeverity): React.ReactNode {
  switch (severity) {
    case 'error':
      return <AlertCircle size={16} />;
    case 'warning':
      return <AlertTriangle size={16} />;
    case 'suggestion':
      return <Lightbulb size={16} />;
    case 'info':
    default:
      return <Info size={16} />;
  }
}

export const ClickableIssue: React.FC<ClickableIssueProps> = ({ issue, onView }) => {
  return (
    <div className={`clickable-issue clickable-issue--${issue.severity}`}>
      <div className="clickable-issue__header">
        <span className="clickable-issue__icon">{getSeverityIcon(issue.severity)}</span>
        <span className="clickable-issue__number">{issue.number}.</span>
        <span className="clickable-issue__title">{issue.title}</span>
        <button
          className="clickable-issue__view-btn"
          onClick={() => onView(issue.affectedIds)}
          title="View on canvas"
        >
          <Eye size={14} />
          <span>View</span>
        </button>
      </div>
      <p className="clickable-issue__description">{issue.description}</p>
      {issue.fix && (
        <div className="clickable-issue__fix">
          <strong>Fix:</strong> {issue.fix}
        </div>
      )}
    </div>
  );
};

/**
 * Parse AI response for issue markers and create issue data
 * Uses simple line-by-line parsing to avoid ReDoS vulnerabilities
 */
export function parseIssuesFromResponse(response: string): {
  issues: IssueData[];
  cleanedResponse: string;
} {
  const issues: IssueData[] = [];

  // Split into lines for simple parsing (avoids complex regex backtracking)
  const lines = response.split('\n');
  let issueNumber = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Try to match structured format: [1] [ERROR] Title [COMPONENT_ID]
    // Use simple string operations instead of complex regex
    if (line.startsWith('[') && line.length > 3) {
      const bracketMatch = line.match(/^\[(\d+)\]\s*\[(ERROR|WARNING|SUGGESTION|INFO)\]/i);
      if (bracketMatch) {
        issueNumber++;
        const severity = bracketMatch[2].toLowerCase() as HighlightSeverity;

        // Extract title and optional component ID from rest of line
        let rest = line.slice(bracketMatch[0].length).trim();
        let componentId: string | undefined;

        // Check for component ID at end: [COMPONENT_ID]
        const idMatch = rest.match(/\[([^\]]+)\]$/);
        if (idMatch) {
          componentId = idMatch[1];
          rest = rest.slice(0, -idMatch[0].length).trim();
        }

        const title = rest || 'Issue';
        const description = (i + 1 < lines.length) ? lines[i + 1].trim() : '';

        // Check for fix on next line (starts with →)
        let fix: string | undefined;
        if (i + 2 < lines.length && lines[i + 2].trim().startsWith('→')) {
          fix = lines[i + 2].trim().slice(1).trim();
        }

        issues.push({
          id: `issue-${issueNumber}`,
          number: issueNumber,
          severity: severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : severity === 'suggestion' ? 'suggestion' : 'info',
          title,
          description,
          fix,
          affectedIds: componentId ? [componentId] : []
        });
        continue;
      }
    }

    // Try simpler emoji format: 1. ❌ Title
    const emojiMatch = line.match(/^(\d+)\.\s*(❌|⚠️|💡|ℹ️)?\s*/);
    if (emojiMatch) {
      const emoji = emojiMatch[2];
      // Only process if there's an emoji or it looks like an issue
      if (emoji) {
        issueNumber++;
        let severity: HighlightSeverity = 'info';
        if (emoji === '❌') severity = 'error';
        else if (emoji === '⚠️') severity = 'warning';
        else if (emoji === '💡') severity = 'suggestion';

        let rest = line.slice(emojiMatch[0].length).trim();

        // Remove markdown bold markers
        rest = rest.replace(/\*\*/g, '');

        // Check for component ID
        let componentId: string | undefined;
        const idMatch = rest.match(/\[([^\]]+)\]$/);
        if (idMatch) {
          componentId = idMatch[1];
          rest = rest.slice(0, -idMatch[0].length).trim();
        }

        const title = rest || 'Issue';
        const description = (i + 1 < lines.length) ? lines[i + 1].trim() : '';

        let fix: string | undefined;
        if (i + 2 < lines.length && lines[i + 2].trim().startsWith('→')) {
          fix = lines[i + 2].trim().slice(1).trim();
        }

        issues.push({
          id: `issue-${issueNumber}`,
          number: issueNumber,
          severity,
          title,
          description,
          fix,
          affectedIds: componentId ? [componentId] : []
        });
      }
    }
  }

  return { issues, cleanedResponse: response };
}

export default ClickableIssue;
