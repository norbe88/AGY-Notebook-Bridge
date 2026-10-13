import React, { useRef, useState, useEffect } from 'react';

interface AudioPlayerProps {
  audioUrl?: string;
  onGenerateAudio: () => void;
  onOpenFile?: (filePath: string) => void;
  isGenerating?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  onGenerateAudio,
  onOpenFile,
  isGenerating
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoaded = () => setDuration(audio.duration || 0);
    const handleTime = () => setCurrentTime(audio.currentTime || 0);

    audio.addEventListener('loadedmetadata', handleLoaded);
    audio.addEventListener('timeupdate', handleTime);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoaded);
      audio.removeEventListener('timeupdate', handleTime);
    };
  }, [audioUrl]);

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 8
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text)' }}>
            AUDIO OVERVIEW (PODCAST)
          </span>
          {isGenerating && <span className="badge amber">Generating...</span>}
        </div>

        <button
          onClick={onGenerateAudio}
          disabled={isGenerating}
          style={{ fontSize: 11, padding: '2px 8px' }}
        >
          {isGenerating ? 'Synthesizing...' : 'Generate Podcast'}
        </button>
      </div>

      {audioUrl ? (
        <div>
          <audio
            ref={audioRef}
            controls
            src={audioUrl}
            style={{ width: '100%', marginBottom: 10 }}
          >
            <source src={audioUrl} type="audio/mpeg" />
          </audio>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 11
            }}
          >
            {/* Speed toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>Speed:</span>
              {[1.0, 1.25, 1.5, 2.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => handleSpeedChange(rate)}
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    background: playbackRate === rate ? 'var(--accent)' : 'var(--bg-subtle)',
                    color: playbackRate === rate ? '#18181b' : 'var(--text)',
                    fontWeight: playbackRate === rate ? 700 : 500
                  }}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Time Telemetry & Open button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {duration > 0 && (
                <span className="mono" style={{ color: 'var(--text-muted)' }}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              )}
              {onOpenFile && (
                <button
                  onClick={() => onOpenFile(audioUrl)}
                  style={{ fontSize: 10, padding: '2px 8px' }}
                  title="Open audio file in OS default player"
                >
                  Open File
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>
          No audio overview generated yet for this notebook. Click "Generate Podcast" to create a 2-host conversational Audio Overview.
        </div>
      )}
    </div>
  );
};
