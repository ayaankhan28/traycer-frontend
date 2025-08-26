'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileText } from 'lucide-react';

interface HighlightedMarkdownProps {
  content: string;
  className?: string;
}

// Function to parse content and replace file name markers with highlighted components
const parseFileNames = (content: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const regex = /\{\{filename:([^}]+)\}\}/g;
  let lastIndex = 0;
  let match;
  let keyCounter = 0;

  while ((match = regex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      const beforeText = content.slice(lastIndex, match.index);
      if (beforeText) {
        parts.push(
          <ReactMarkdown 
            key={`text-${keyCounter++}`}
            remarkPlugins={[remarkGfm]}
          >
            {beforeText}
          </ReactMarkdown>
        );
      }
    }

    // Add highlighted filename
    const filename = match[1];
    parts.push(
      <span
        key={`filename-${keyCounter++}`}
        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-md font-mono text-sm mx-1 hover:bg-blue-500/30 transition-colors"
      >
        <FileText className="w-3 h-3" />
        {filename}
      </span>
    );

    lastIndex = regex.lastIndex;
  }

  // Add remaining text after the last match
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex);
    if (remainingText) {
      parts.push(
        <ReactMarkdown 
          key={`text-${keyCounter++}`}
          remarkPlugins={[remarkGfm]}
        >
          {remainingText}
        </ReactMarkdown>
      );
    }
  }

  return parts;
};

export function HighlightedMarkdown({ content, className = '' }: HighlightedMarkdownProps) {
  // Check if content contains file name markers
  const hasFileNames = /\{\{filename:([^}]+)\}\}/.test(content);

  if (!hasFileNames) {
    // If no file names, render normal markdown
    return (
      <div className={className}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  // If file names are present, parse and highlight them
  const parsedContent = parseFileNames(content);

  return (
    <div className={className}>
      {parsedContent.map((part, index) => (
        <React.Fragment key={index}>{part}</React.Fragment>
      ))}
    </div>
  );
}
