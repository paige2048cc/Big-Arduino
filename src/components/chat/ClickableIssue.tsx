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
 */
export function parseIssuesFromResponse(response: string): {
  issues: IssueData[];
  cleanedResponse: string;
} {
  const issues: IssueData[] = [];
  let issueNumber = 0;

  // Pattern to match issue blocks like:
  // [1] [ERROR] Title [COMPONENT_ID]
  // Description
  // → Fix suggestion
  const issuePattern = /\[(\d+)\]\s*\[(ERROR|WARNING|SUGGESTION|INFO)\]\s*([^\n\[]+)(?:\[([^\]]+)\])?\n([^\n]+)(?:\n→\s*(.+))?/gi;

  let match;
  while ((match = issuePattern.exec(response)) !== null) {
    issueNumber++;
    const severity = match[2].toLowerCase() as HighlightSeverity;
    const title = match[3].trim();
    const componentId = match[4];
    const description = match[5].trim();
    const fix = match[6]?.trim();

    issues.push({
      id: `issue-${issueNumber}`,
      number: issueNumber,
      severity: severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : severity === 'suggestion' ? 'suggestion' : 'info',
      title,
      description,
      fix,
      affectedIds: componentId ? [componentId] : []
    });
  }

  // Also try simpler pattern: numbered list with severity emoji
  if (issues.length === 0) {
    const simplePattern = /(\d+)\.\s*(❌|⚠️|💡|ℹ️)?\s*\*?\*?([^*\n:]+)\*?\*?\s*(?:\[([^\]]+)\])?\n\s*([^\n]+)(?:\n\s*→\s*(.+))?/g;

    while ((match = simplePattern.exec(response)) !== null) {
      issueNumber++;
      const emoji = match[2];
      let severity: HighlightSeverity = 'info';
      if (emoji === '❌') severity = 'error';
      else if (emoji === '⚠️') severity = 'warning';
      else if (emoji === '💡') severity = 'suggestion';

      const title = match[3].trim();
      const componentId = match[4];
      const description = match[5].trim();
      const fix = match[6]?.trim();

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

  // Clean the response by removing issue blocks (if we want to show them differently)
  // For now, keep the original response
  return { issues, cleanedResponse: response };
}

export default ClickableIssue;
