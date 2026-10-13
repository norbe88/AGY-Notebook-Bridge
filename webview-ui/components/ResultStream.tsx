import React from 'react';

interface ResultStreamProps {
  content: string;
  isLoading: boolean;
  onSaveToWorkspace: () => void;
  savedPath?: string;
}

export const ResultStream: React.FC<ResultStreamProps> = ({
  content,
  isLoading,
  onSaveToWorkspace,
  savedPath
}) => {
  if (!content && !isLoading) {
    return null;
  }

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 12,
        marginBottom: 16
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 6
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>
            [RESULT STREAM]
          </span>
          {isLoading && (
            <span className="badge amber">
              Streaming...
            </span>
          )}
        </div>

        {content && !isLoading && (
          <button
            onClick={onSaveToWorkspace}
            style={{ fontSize: 11, padding: '2px 8px' }}
          >
            Save to Workspace (.md)
          </button>
        )}
      </div>

      {savedPath && (
        <div style={{ fontSize: 11, color: 'var(--success)', marginBottom: 8 }}>
          ✓ Saved to: <span className="mono">{savedPath}</span>
        </div>
      )}

      <div
        style={{
          whiteSpace: 'pre-wrap',
          fontSize: 12,
          lineHeight: 1.6,
          maxHeight: 320,
          overflowY: 'auto'
        }}
      >
        {content}
      </div>
    </div>
  );
};
