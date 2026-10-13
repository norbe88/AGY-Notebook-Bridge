import React, { useRef, useState } from 'react';

interface AudioPlayerProps {
  audioUrl?: string;
  onGenerateAudio: () => void;
  isGenerating?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  onGenerateAudio,
  isGenerating
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

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
          marginBottom: 8
        }}
      >
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>
          Audio Overview (Podcast)
        </span>
        <button
          onClick={onGenerateAudio}
          disabled={isGenerating}
          style={{ fontSize: 11, padding: '2px 8px' }}
        >
          {isGenerating ? 'Generating...' : 'Generate New Audio'}
        </button>
      </div>

      {audioUrl ? (
        <div>
          <audio
            ref={audioRef}
            controls
            src={audioUrl}
            style={{ width: '100%', marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Speed:</span>
            {[1.0, 1.25, 1.5, 2.0].map((rate) => (
              <button
                key={rate}
                onClick={() => handleSpeedChange(rate)}
                style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  background: playbackRate === rate ? 'var(--accent)' : 'var(--bg-subtle)',
                  color: playbackRate === rate ? '#18181b' : 'var(--text)'
                }}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          No audio overview generated yet for this notebook.
        </div>
      )}
    </div>
  );
};
