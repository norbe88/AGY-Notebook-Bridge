import React from 'react';

export interface NotebookItem {
  id: string;
  title: string;
  sourceCount: number;
  updatedAt?: string;
}

interface NotebookListProps {
  notebooks: NotebookItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onSync: () => void;
  onRefresh: () => void;
}

export const NotebookList: React.FC<NotebookListProps> = ({
  notebooks,
  selectedId,
  onSelect,
  onSync,
  onRefresh
}) => {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>
          Active Notebook
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onRefresh}
            title="Refresh notebook list"
            style={{ padding: '2px 8px', fontSize: 11 }}
          >
            ↻
          </button>
          <button
            onClick={onSync}
            title="Sync local docs/notebooklm_sources to active notebook"
            style={{ padding: '2px 8px', fontSize: 11 }}
            className="primary"
          >
            Sync Sources
          </button>
        </div>
      </div>

      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        style={{ width: '100%' }}
      >
        <option value="" disabled>-- Select a Notebook --</option>
        {notebooks.map((nb) => (
          <option key={nb.id} value={nb.id}>
            {nb.title} ({nb.sourceCount} sources)
          </option>
        ))}
      </select>
    </div>
  );
};
