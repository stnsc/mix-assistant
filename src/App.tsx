import { useState, useRef, useEffect } from 'react';
import { useEssentia } from './hooks/useEssentia';
import TrackUploader from './components/TrackUploader';
import SetlistTable, { type Track } from './components/SetlistTable';
import {
  saveTracksToStorage,
  loadTracksFromStorage,
  deleteTrackFromStorage,
  clearAllTracksFromStorage,
  getAudioMimeType,
} from './utils/trackStorage';

let nextId = 1;

export default function App() {
  const { ready, analyzeFile } = useEssentia();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [loadedFromStorage, setLoadedFromStorage] = useState<boolean>(false);

  // Playback state
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load Saved Tracks from Storage on Initial Mount
  useEffect(() => {
    async function restoreTracks() {
      const savedTracks = await loadTracksFromStorage();
      if (savedTracks.length > 0) {
        const maxId = Math.max(...savedTracks.map((t) => t.id), 0);
        nextId = maxId + 1;
        setTracks(savedTracks);
      }
      setLoadedFromStorage(true);
    }
    restoreTracks();
  }, []);

  // Auto-Save Tracks to Storage whenever tracks state updates (after initial load)
  useEffect(() => {
    if (!loadedFromStorage) return;
    const isAnalyzing = tracks.some((t) => t.analyzing);
    if (!isAnalyzing) {
      saveTracksToStorage(tracks);
    }
  }, [tracks, loadedFromStorage]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      console.warn('Audio element error encountered:', audio.error);
    };

    const handleStalled = () => {
      console.warn('Audio playback stalled, attempting to resume...');
      if (!audio.paused) {
        audio.play().catch(() => {});
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('stalled', handleStalled);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('stalled', handleStalled);
      audio.pause();
    };
  }, []);

  async function handleFilesSelected(files: File[]) {
    setAnalyzing(true);
    const newTracks: Track[] = [];

    for (const file of files) {
      const id = nextId++;
      try {
        const mimeType = getAudioMimeType(file.name, file.type);
        const buffer = await file.arrayBuffer();
        const blob = new Blob([buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const cleanFile = new File([blob], file.name, { type: mimeType });

        const newTrack: Track & { _blob?: Blob } = {
          id,
          name: file.name,
          file: cleanFile,
          _blob: blob,
          url,
          analyzing: true,
        };
        newTracks.push(newTrack);

        setTracks((prev) => [...prev, newTrack]);

        const result = await analyzeFile(cleanFile);
        setTracks((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, ...result, analyzing: false } : t
          )
        );
      } catch (err) {
        console.error('Analysis failed for', file.name, err);
        setTracks((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, analyzing: false, error: true } : t
          )
        );
      }
    }
    setAnalyzing(false);
  }

  function handleReorderTracks(newTracks: Track[]) {
    setTracks(newTracks);
  }

  function handleDeleteTrack(id: number) {
    if (playingTrackId === id) {
      handleStopTrack();
    }
    setTracks((prev) => prev.filter((t) => t.id !== id));
    deleteTrackFromStorage(id);
  }

  function handleClearAllTracks() {
    handleStopTrack();
    setTracks([]);
    clearAllTracksFromStorage();
  }

  function handlePlayTrack(track: Track) {
    if (!track.url || !audioRef.current) return;

    if (playingTrackId === track.id) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.src = track.url;
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setPlayingTrackId(track.id);
      setIsPlaying(true);
    }
  }

  function handlePauseTrack() {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }

  function handleStopTrack() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setPlayingTrackId(null);
    setCurrentTime(0);
  }

  function handleSeekTrack(track: Track, ratio: number) {
    if (!track.duration || !audioRef.current) return;
    const targetTime = ratio * track.duration;

    if (playingTrackId !== track.id) {
      if (track.url) {
        audioRef.current.src = track.url;
        setPlayingTrackId(track.id);
      }
    }
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);

    if (!isPlaying) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }

  return (
    <div
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '40px 20px',
        minHeight: '100vh',
      }}
    >
      {/* Header Banner */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1
          style={{
            fontSize: '42px',
            fontWeight: 800,
            color: 'white',
            margin: '0 0 10px',
            background: '#0000006c',
            backdropFilter: 'blur(4px)',
            padding: '12px'
          }}
        >
          MIX ASSISTANT
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: 'white',
            margin: 0,
            background: '#0000006c',
            backdropFilter: 'blur(4px)',
            padding: '6px'
          }}
        >
          DJ Mix Analyzer & Transition Advisor
        </p>
      </div>

      {!ready && (
        <div
          style={{
            padding: '16px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(0, 229, 255, 0.3)',
            color: '#ffffff',
            textAlign: 'center',
            marginBottom: '24px',
            fontSize: '14px',
            borderRadius: '8px',
          }}
        >
          Loading audio DSP analysis engine…
        </div>
      )}

      {/* File Dropzone Uploader */}
      <TrackUploader onFilesSelected={handleFilesSelected} disabled={!ready} />

      {analyzing && (
        <p
          style={{
            textAlign: 'center',
            color: 'white',
            marginTop: '16px',
            fontWeight: 600,
            background: 'black',
            padding: '12px',
          }}
        >
          Analyzing audio structure...
        </p>
      )}

      {/* Track Setlist Table */}
      <div style={{ marginTop: '32px' }}>
        <SetlistTable
          tracks={tracks}
          onReorder={handleReorderTracks}
          playingTrackId={playingTrackId}
          isPlaying={isPlaying}
          currentTime={currentTime}
          onPlay={handlePlayTrack}
          onPause={handlePauseTrack}
          onStop={handleStopTrack}
          onSeek={handleSeekTrack}
          onDeleteTrack={handleDeleteTrack}
          onClearAll={handleClearAllTracks}
        />
      </div>

      {/* Bottom Right Creator Info Box */}
      <div
        style={{ 
          maxWidth: '200px',
          height: 'auto',
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          padding: '14px',
          background: 'rgba(18, 20, 30, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: '12px',
          fontWeight: 500,
          backdropFilter: 'blur(10px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          userSelect: 'none',
        }}
      >
        Made by
        <span style={{ color: '#00ff80', fontWeight: 700 }}>Vladut Stanescu</span>
        with AI Tools, Essentia.js & 💚
        <span style={{ color: '#ffffff', fontWeight: 700, textDecoration: 'underline' }}><a href="https://stnsc.net" target="_blank" rel="noopener noreferrer">stnsc.net</a></span>
      </div>
    </div>
  );
}



