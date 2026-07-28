import React, { useRef, useEffect } from 'react';

interface WaveformCanvasProps {
  peaks?: number[];
  progress: number; // 0 to 1
  height?: number;
  onSeek?: (ratio: number) => void;
}

// --- Smooth Color Interpolation Helpers ---

/**
 * Helper to smoothly blend two hex/rgb colors based on a factor (0 to 1)
 */
function lerpColor(color1: string, color2: string, factor: number): string {
  const parse = (c: string): [number, number, number, number] => {
    if (c.startsWith('#')) {
      const r = parseInt(c.slice(1, 3), 16);
      const g = parseInt(c.slice(3, 5), 16);
      const b = parseInt(c.slice(5, 7), 16);
      return [r, g, b, 1.0];
    }
    const match = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    return match 
      ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), match[4] !== undefined ? parseFloat(match[4]) : 1.0] 
      : [0, 0, 0, 1.0];
  };

  const [r1, g1, b1, a1] = parse(color1);
  const [r2, g2, b2, a2] = parse(color2);

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);
  const a = (a1 + (a2 - a1) * factor).toFixed(2);

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Generates an array of 101 colors mapping smoothly from 0.0 to 1.0 amplitude
 */
function generateGradientPalette(isPlayed: boolean): string[] {
  const palette: string[] = [];
  const colors = isPlayed 
    ? { cool: '#00e5ff', warm: '#ffaa00', hot: '#ff0044' }
    : { cool: 'rgba(0, 130, 150, 0.4)', warm: 'rgba(160, 110, 0, 0.45)', hot: 'rgba(180, 20, 50, 0.45)' };

  for (let i = 0; i <= 100; i++) {
    const amp = i / 100;
    if (amp <= 0.45) {
      // Smoothly blend from blue to yellow (0.0 to 0.45)
      palette.push(lerpColor(colors.cool, colors.warm, amp / 0.45));
    } else if (amp <= 0.70) {
      // Smoothly blend from yellow to red (0.45 to 0.70)
      palette.push(lerpColor(colors.warm, colors.hot, (amp - 0.45) / (0.70 - 0.45)));
    } else {
      // Pure hot peak color (0.70 to 1.0)
      palette.push(colors.hot);
    }
  }
  return palette;
}

// Statically pre-generate lookup arrays once globally to optimize runtime frame loops
const PLAYED_PALETTE = generateGradientPalette(true);
const UNPLAYED_PALETTE = generateGradientPalette(false);

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  peaks = [],
  progress,
  height = 54,
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.offsetWidth;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const centerY = height / 2;

    if (!peaks || peaks.length === 0) {
      // Placeholder realistic sine/noise waveform preview
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 2) {
        const amp = Math.sin(x * 0.05) * 0.3 + Math.cos(x * 0.1) * 0.2 + 0.2;
        const h = Math.max(2, amp * (centerY - 4));
        ctx.moveTo(x, centerY - h);
        ctx.lineTo(x, centerY + h);
      }
      ctx.stroke();
      return;
    }

    const totalSamples = peaks.length;
    const progressX = progress * width;

    // Draw high-density vertical continuous lines for a realistic, pixel-accurate audio waveform
    for (let x = 0; x < width; x += 1) {
      const sampleIndex = Math.min(
        totalSamples - 1,
        Math.floor((x / width) * totalSamples)
      );
      
      // Clamp the amplitude strictly between 0.0 and 1.0
      const amplitude = Math.max(0, Math.min(1, peaks[sampleIndex]));

      // Mirror top & bottom around center line
      const barHeight = Math.max(2, amplitude * (centerY - 3));
      const topY = centerY - barHeight;
      const bottomY = centerY + barHeight;

      const isPlayed = x <= progressX;

      // Map amplitude to palette indices (0 to 100 range)
      const paletteIndex = Math.round(amplitude * 100);
      const color = isPlayed ? PLAYED_PALETTE[paletteIndex] : UNPLAYED_PALETTE[paletteIndex];

      ctx.fillStyle = color;
      ctx.fillRect(x, topY, 1.2, bottomY - topY);
    }

    // Draw subtle center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }, [peaks, progress, height]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'relative',
        width: '100%',
        height: `${height}px`,
        cursor: 'pointer',
        userSelect: 'none',
        overflow: 'hidden',
        background: 'rgba(10, 12, 20, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: 'inset 0 0 12px rgba(0, 0, 0, 0.6)',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
      {/* Red scrub line for playback position */}
      {progress > 0 && progress <= 1 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${progress * 100}%`,
            width: '2px',
            backgroundColor: '#ff0044',
            boxShadow: '0 0 12px #ff0044, 0 0 4px #ff0000',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
        </div>
      )}
    </div>
  );
};
