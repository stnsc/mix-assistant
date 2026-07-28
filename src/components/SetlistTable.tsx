import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WaveformCanvas } from './WaveformCanvas';
import { MixTransitionLine } from './MixTransitionLine';
import { optimizeSetlistOrder } from '../utils/mixAnalyzer';

export interface Track {
  id: number;
  name: string;
  file?: File;
  url?: string;
  analyzing?: boolean;
  error?: boolean;
  bpm?: number;
  key?: string;
  scale?: string;
  keyLabel?: string;
  camelot?: string;
  genre?: string;
  peaks?: number[];
  duration?: number;
}

interface RowProps {
  track: Track;
  isPlaying: boolean;
  isCurrentPlayingTrack: boolean;
  currentTime: number;
  onPlay: (track: Track) => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (track: Track, ratio: number) => void;
  onDelete?: (id: number) => void;
}

function FormatTime({ seconds }: { seconds: number }) {
  if (!seconds || isNaN(seconds)) return <span>0:00</span>;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return (
    <span>
      {mins}:{secs < 10 ? `0${secs}` : secs}
    </span>
  );
}

function Row({
  track,
  isPlaying,
  isCurrentPlayingTrack,
  currentTime,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onDelete,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: track.id });

  const progress =
    isCurrentPlayingTrack && track.duration && track.duration > 0
      ? currentTime / track.duration
      : 0;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    background: isCurrentPlayingTrack
      ? 'linear-gradient(90deg, rgba(255, 0, 85, 0.12) 0%, rgba(20, 22, 32, 0.95) 100%)'
      : 'rgba(22, 24, 34, 0.85)',
    border: isCurrentPlayingTrack
      ? '1px solid rgba(255, 0, 85, 0.4)'
      : '1px solid rgba(255, 255, 255, 0.08)',
    marginBottom: '4px',
    padding: '12px 16px',
    boxShadow: isCurrentPlayingTrack
      ? '0 4px 20px rgba(255, 0, 85, 0.15)'
      : '0 2px 8px rgba(0, 0, 0, 0.2)',
    backdropFilter: 'blur(10px)',
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Top Header Row with Drag Handle, Track Name, Badges, and Playback Controls */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto auto',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '10px',
        }}
      >
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          style={{
            cursor: 'grab',
            padding: '4px 8px',
            color: 'rgba(255, 255, 255, 0.4)',
            userSelect: 'none',
            fontSize: '18px',
          }}
          title="Drag to reorder"
        >
          ⋮⋮
        </div>

        {/* Track Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          {/* Delete Track Button */}
          {onDelete && (
            <button
              onClick={() => onDelete(track.id)}
              title="Delete track"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'rgba(255, 255, 255, 0.6)',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: '"Space Grotesk", sans-serif',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 42, 95, 0.25)';
                e.currentTarget.style.borderColor = 'rgba(255, 42, 95, 0.5)';
                e.currentTarget.style.color = '#ff2a5f';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
              }}
            >
              Clear
            </button>
          )}
          <span
            style={{
              fontWeight: 600,
              color: '#ffffff',
              fontSize: '15px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {track.name}
          </span>
          {track.analyzing && (
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                background: 'rgba(0, 229, 255, 0.15)',
                color: '#00e5ff',
                border: '1px solid rgba(0, 229, 255, 0.3)',
              }}
            >
              Analyzing…
            </span>
          )}
          {track.error && (
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                background: 'rgba(255, 42, 95, 0.15)',
                color: '#ff2a5f',
                border: '1px solid rgba(255, 42, 95, 0.3)',
              }}
            >
              Error
            </span>
          )}
        </div>

        {/* Metadata Pills: BPM, Key */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              padding: '4px 10px',
              fontSize: '13px',
              color: track.bpm ? '#fafafa' : 'rgba(255, 255, 255, 0.4)',
              fontWeight: 700,
            }}
          >
            {track.bpm ? `${track.bpm} BPM` : '—'}
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              padding: '4px 10px',
              fontSize: '13px',
              color: '#ffffff',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{track.keyLabel || '—'}</span>
            {track.camelot && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#00e5ff',
                  background: 'rgba(0, 229, 255, 0.15)',
                  padding: '1px 6px',
                }}
              >
                {track.camelot}
              </span>
            )}
          </div>
        </div>

        {/* Playback Action Buttons & Delete Button */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isCurrentPlayingTrack && isPlaying ? (
            <button
              onClick={onPause}
              style={{
                background: '#ffaa00',
                border: 'none',
                color: '#000',
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              ⏸ Pause
            </button>
          ) : (
            <button
              onClick={() => onPlay(track)}
              disabled={track.analyzing}
              style={{
                background: track.analyzing
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgb(89, 255, 67)',
                border: 'none',
                color: track.analyzing ? 'rgba(255, 255, 255, 0.3)' : '#000',
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                padding: '6px 14px',
                cursor: track.analyzing ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Play
            </button>
          )}

          {isCurrentPlayingTrack && (
            <button
              onClick={onStop}
              style={{
                background: 'rgba(255, 42, 95, 0.2)',
                border: '1px solid rgba(255, 42, 95, 0.4)',
                color: '#ff2a5f',
                fontWeight: 600,
                fontFamily: '"Space Grotesk", sans-serif',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              ⏹ Stop
            </button>
          )}

          
        </div>
      </div>

      {/* Volume Heatmap Graph Waveform */}
      <div style={{ position: 'relative', marginTop: '6px' }}>
        <WaveformCanvas
          peaks={track.peaks}
          progress={progress}
          height={40}
          onSeek={(ratio) => onSeek(track, ratio)}
        />
        {/* Time display overlaid on waveform */}
        {track.duration && (
          <div
            style={{
              position: 'absolute',
              right: '8px',
              bottom: '4px',
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.6)',
              pointerEvents: 'none',
              background: 'rgba(0, 0, 0, 0.5)',
              padding: '1px 6px',
            }}
          >
            {isCurrentPlayingTrack ? (
              <>
                <FormatTime seconds={currentTime} /> / <FormatTime seconds={track.duration} />
              </>
            ) : (
              <FormatTime seconds={track.duration} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface SetlistTableProps {
  tracks: Track[];
  onReorder: (tracks: Track[]) => void;
  playingTrackId: number | null;
  isPlaying: boolean;
  currentTime: number;
  onPlay: (track: Track) => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (track: Track, ratio: number) => void;
  onDeleteTrack?: (id: number) => void;
  onClearAll?: () => void;
}

export default function SetlistTable({
  tracks,
  onReorder,
  playingTrackId,
  isPlaying,
  currentTime,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onDeleteTrack,
  onClearAll,
}: SetlistTableProps) {
  const sensors = useSensors(useSensor(PointerSensor));
  const [notification, setNotification] = useState<string | null>(null);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tracks.findIndex((t) => t.id === active.id);
    const newIndex = tracks.findIndex((t) => t.id === over.id);
    onReorder(arrayMove(tracks, oldIndex, newIndex));
  }

  function handleAutoOptimize() {
    const sorted = optimizeSetlistOrder(tracks);
    onReorder(sorted);
    setNotification(
      'Setlist reordered for harmonic key & tempo fit, preferring a rising energy journey.'
    );
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  }

  if (tracks.length === 0) {
    return null;
  }

  return (
    <div>
      {/* Control Toolbar Above Table */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          padding: '12px 16px',
          background: 'rgba(34, 34, 34, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.40)',
          backdropFilter: 'blur(8px)',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px', fontWeight: 600 }}>
          Setlist ({tracks.length} track{tracks.length > 1 ? 's' : ''})
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {tracks.length >= 2 && (
            <button
              onClick={handleAutoOptimize}
              style={{
                background: 'rgba(42, 255, 53, 0.12)',
                border: '1px solid rgba(42, 255, 53, 0.35)',
                color: '#2aff35',
                fontWeight: 700,
                fontFamily: 'inherit',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(42, 255, 53, 0.25)';
                e.currentTarget.style.borderColor = 'rgba(42, 255, 53, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(42, 255, 53, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(42, 255, 53, 0.35)';
              }}
            >
              Smart Auto-Reorder (Best Mix Flow)
            </button>
          )}

          {onClearAll && (
            <button
              onClick={onClearAll}
              style={{
                background: 'rgba(255, 42, 95, 0.12)',
                border: '1px solid rgba(255, 42, 95, 0.35)',
                color: '#ff2a5f',
                fontWeight: 600,
                fontFamily: 'inherit',
                padding: '8px 14px',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 42, 95, 0.25)';
                e.currentTarget.style.borderColor = 'rgba(255, 42, 95, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 42, 95, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(255, 42, 95, 0.35)';
              }}
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Optimization Notification Toast */}
      {notification && (
        <div
          style={{
            marginBottom: '16px',
            padding: '10px 16px',
            background: 'rgba(0, 230, 118, 0.15)',
            border: '1px solid rgba(0, 230, 118, 0.4)',
            color: '#00e676',
            fontSize: '13px',
            fontWeight: 600,
            textAlign: 'center',
            animation: 'fadeIn 0.3s ease-out',
          }}
        >
          {notification}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={tracks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tracks.map((track, index) => (
            <React.Fragment key={track.id}>
              <Row
                track={track}
                isCurrentPlayingTrack={playingTrackId === track.id}
                isPlaying={isPlaying}
                currentTime={currentTime}
                onPlay={onPlay}
                onPause={onPause}
                onStop={onStop}
                onSeek={onSeek}
                onDelete={onDeleteTrack}
              />
              {index < tracks.length - 1 && (
                <MixTransitionLine
                  trackA={track}
                  trackB={tracks[index + 1]}
                />
              )}
            </React.Fragment>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
