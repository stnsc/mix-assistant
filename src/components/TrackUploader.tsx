import React, { useRef } from 'react';

interface TrackUploaderProps {
  onFilesSelected: (files: File[]) => void;
  disabled: boolean;
}

export default function TrackUploader({ onFilesSelected, disabled }: TrackUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length) onFilesSelected(files);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files || []).filter((f) =>
      f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|flac|aac|ogg|m4a)$/i)
    );
    if (files.length) onFilesSelected(files);
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => !disabled && fileInputRef.current?.click()}
      style={{
        border: '2px dashed rgba(255, 255, 255, 0.4)',
        padding: 32,
        textAlign: 'center',
        background: 'rgba(68, 68, 68, 0.6)',
        backdropFilter: 'blur(12px)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s ease',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      }}
    >
      <h3 style={{ margin: '0 0 8px', color: '#ffffff', fontSize: '18px', fontWeight: 600 }}>
        Drop audio files here, or click to browse
      </h3>
      <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>
        Supports MP3, WAV, FLAC, AAC, OGG
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        disabled={disabled}
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}
