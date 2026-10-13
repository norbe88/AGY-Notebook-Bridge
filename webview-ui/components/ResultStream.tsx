import React, { useMemo, useState } from 'react';
import { marked } from 'marked';

interface ResultStreamProps {
  content: string;
  isLoading: boolean;
  onSaveToWorkspace: () => void;
  onOpenFile?: (filePath: string) => void;
  savedPath?: string;
}

export const ResultStream: React.FC<ResultStreamProps> = ({
  content,
  isLoading,
  onSaveToWorkspace,
  onOpenFile,
  savedPath
}) => {
  const [copied, setCopied] = useState(false);

  const htmlContent = useMemo(() => {
    if (!content) return '';
    try {
      return marked.parse(content, { async: false, breaks: true }) as string;
    } catch {
      return content;
    }
  }, [content]);

  if (!content && !isLoading) {
    return null;
  }

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 14,
        marginBottom: 16
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 6,
          marginBottom: 10,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 8
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {isLoading && <span className="pulse-dot" />}
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'var(--accent)' }}>
            {isLoading ? 'STREAMING...' : 'RESEARCH RESULT'}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          {content && (
            <button
              onClick={handleCopy}
              style={{ fontSize: 11, padding: '2px 8px' }}
              title="Copy raw markdown to clipboard"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          )}

          {content && !isLoading && (
            <button
              onClick={onSaveToWorkspace}
              className="primary"
              style={{ fontSize: 11, padding: '2px 8px' }}
              title="Save markdown document into docs/research/ in workspace"
            >
              Save (.md)
            </button>
          )}
        </div>
      </div>

      {savedPath && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 6,
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            padding: '6px 10px',
            borderRadius: 'var(--radius)',
            fontSize: 11,
            color: 'var(--success)',
            marginBottom: 10,
            overflowWrap: 'anywhere'
          }}
        >
          <span style={{ wordBreak: 'break-all' }}>✓ Saved: <strong className="mono">{savedPath}</strong></span>
          {onOpenFile && (
            <button
              onClick={() => onOpenFile(savedPath)}
              style={{ fontSize: 10, padding: '1px 6px', whiteSpace: 'nowrap' }}
            >
              Open in Editor
            </button>
          )}
        </div>
      )}

      <div
        className="markdown-body"
        style={{
          maxHeight: 420,
          overflowY: 'auto',
          paddingRight: 4
        }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
};
