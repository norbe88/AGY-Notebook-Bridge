import React, { useState } from 'react';

interface QueryInputProps {
  onRunQuery: (query: string, mode: 'fast' | 'deep') => void;
  isLoading: boolean;
}

export const QueryInput: React.FC<QueryInputProps> = ({ onRunQuery, isLoading }) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'fast' | 'deep'>('fast');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isLoading) return;
    onRunQuery(query.trim(), mode);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>
          Research Query
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as 'fast' | 'deep')}
            style={{ fontSize: 11, padding: '2px 6px' }}
          >
            <option value="fast">⚡ Fast Research</option>
            <option value="deep">🔬 Deep Research</option>
          </select>
        </div>
      </div>

      <textarea
        rows={3}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter research prompt (grounded in notebook sources)... Press Ctrl+Enter to run"
        style={{ width: '100%', resize: 'vertical', marginBottom: 8 }}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="submit"
          className="primary"
          disabled={isLoading || !query.trim()}
          style={{ opacity: isLoading || !query.trim() ? 0.6 : 1 }}
        >
          {isLoading ? 'Running Query...' : 'Run Research'}
        </button>
      </div>
    </form>
  );
};
