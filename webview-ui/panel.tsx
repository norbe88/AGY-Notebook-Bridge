import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { NotebookList, NotebookItem } from './components/NotebookList';
import { QueryInput } from './components/QueryInput';
import { ResultStream } from './components/ResultStream';
import { AudioPlayer } from './components/AudioPlayer';

// Acquire VS Code API
declare function acquireVsCodeApi(): {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
};

const vscode = acquireVsCodeApi();

export const ResearchPanel: React.FC = () => {
  const [authStatus, setAuthStatus] = useState<{ ok: boolean; email?: string; error?: string } | null>(null);
  const [notebooks, setNotebooks] = useState<NotebookItem[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string>('');
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [currentQuery, setCurrentQuery] = useState<string>('');
  const [streamContent, setStreamContent] = useState<string>('');
  const [savedPath, setSavedPath] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);

  useEffect(() => {
    // Notify extension host that webview is mounted
    vscode.postMessage({ type: 'ready' });

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      switch (msg.type) {
        case 'authStatus':
          setAuthStatus(msg.status);
          break;

        case 'notebookList':
          if (Array.isArray(msg.notebooks)) {
            setNotebooks(msg.notebooks);
            if (msg.notebooks.length > 0 && !selectedNotebookId) {
              setSelectedNotebookId(msg.notebooks[0].id);
            }
          }
          break;

        case 'activeNotebookChanged':
          if (msg.notebookId) {
            setSelectedNotebookId(msg.notebookId);
          }
          break;

        case 'queryStart':
          setIsQuerying(true);
          setStreamContent('');
          setSavedPath('');
          break;

        case 'queryChunk':
          setStreamContent((prev) => prev + (msg.chunk || ''));
          break;

        case 'queryDone':
          setIsQuerying(false);
          if (msg.content) {
            setStreamContent(msg.content);
          }
          break;

        case 'queryError':
          setIsQuerying(false);
          setStreamContent((prev) => prev + `\n\n[Error: ${msg.error}]`);
          break;

        case 'savedSuccess':
          setSavedPath(msg.path);
          break;

        case 'audioReady':
          setIsGeneratingAudio(false);
          setAudioUrl(msg.filePath);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedNotebookId]);

  const handleRunQuery = (query: string, mode: 'fast' | 'deep') => {
    setCurrentQuery(query);
    vscode.postMessage({
      type: 'runQuery',
      notebookId: selectedNotebookId,
      query,
      mode
    });
  };

  const handleSaveResult = () => {
    vscode.postMessage({
      type: 'saveResult',
      query: currentQuery,
      content: streamContent
    });
  };

  const handleSyncSources = () => {
    if (!selectedNotebookId) return;
    vscode.postMessage({
      type: 'syncSources',
      notebookId: selectedNotebookId
    });
  };

  const handleRefreshNotebooks = () => {
    vscode.postMessage({ type: 'listNotebooks' });
  };

  const handleSelectNotebook = (id: string) => {
    setSelectedNotebookId(id);
    vscode.postMessage({
      type: 'selectNotebook',
      notebookId: id
    });
  };

  const handleGenerateAudio = () => {
    if (!selectedNotebookId) return;
    setIsGeneratingAudio(true);
    vscode.postMessage({
      type: 'generateAudio',
      notebookId: selectedNotebookId
    });
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      {/* Auth Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 10px',
          background: 'var(--card)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          marginBottom: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--text)' }}>
            NotebookLM
          </span>
          {authStatus?.ok ? (
            <span className="badge green">Connected</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="badge amber">Token Expired</span>
              <button
                onClick={() => vscode.postMessage({ type: 'reauthenticate' })}
                style={{ fontSize: 10, padding: '1px 6px' }}
                className="primary"
                title="Log in via Google Chrome"
              >
                Re-authenticate
              </button>
            </div>
          )}
        </div>
        {authStatus?.email && (
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {authStatus.email}
          </span>
        )}
      </div>

      {/* Notebook Selector */}
      <NotebookList
        notebooks={notebooks}
        selectedId={selectedNotebookId}
        onSelect={handleSelectNotebook}
        onSync={handleSyncSources}
        onRefresh={handleRefreshNotebooks}
      />

      {/* Research Query Input */}
      <QueryInput onRunQuery={handleRunQuery} isLoading={isQuerying} />

      {/* Streamed Research Results */}
      <ResultStream
        content={streamContent}
        isLoading={isQuerying}
        onSaveToWorkspace={handleSaveResult}
        savedPath={savedPath}
      />

      {/* Audio Overview Player */}
      <AudioPlayer
        audioUrl={audioUrl}
        onGenerateAudio={handleGenerateAudio}
        isGenerating={isGeneratingAudio}
      />
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<ResearchPanel />);
}
