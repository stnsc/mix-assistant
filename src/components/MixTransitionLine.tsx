import React, { useState } from 'react';
import { analyzeMixCompatibility, type MixCompatibility } from '../utils/mixAnalyzer';
import type { Track } from './SetlistTable';

interface MixTransitionLineProps {
  trackA: Track;
  trackB: Track;
}

export const MixTransitionLine: React.FC<MixTransitionLineProps> = ({ trackA, trackB }) => {
  const [showDetails, setShowDetails] = useState(false);

  const mix: MixCompatibility = analyzeMixCompatibility(trackA, trackB);

  // Status colors & icons
  const { badgeColor, badgeBg, borderColor, quality } = mix;

  return (
    <div
      style={{
        position: 'relative',
        margin: '4px 0',
        padding: '6px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        userSelect: 'none',
        zIndex: showDetails ? 10 : 2,
      }}
    >
      {/* Background Connecting Vertical/Horizontal Accent Line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '24px',
          right: '24px',
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '2px',
            background: `linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, ${badgeColor} 50%, rgba(255, 255, 255, 0.05) 100%)`,
            transition: 'all 0.3s ease',
          }}
        />
      </div>

      {/* Center Interactive Pill Badge */}
      <div
        onClick={() => setShowDetails((prev) => !prev)}
        onMouseEnter={() => setShowDetails(true)}
        onMouseLeave={() => setShowDetails(false)}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 14px',
          background: quality === 'ANALYZING' ? 'rgba(15, 18, 28, 0.95)' : 'rgba(18, 20, 30, 0.95)',
          border: `1px solid ${borderColor}`,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          transition: 'transform 0.2s ease, boxShadow 0.2s ease',
          transform: showDetails ? 'scale(1.03)' : 'scale(1)',
        }}
      >
        {/* Quality Label Pill */}
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: badgeColor,
            letterSpacing: '0.3px',
          }}
        >
          {mix.badgeText}
        </span>

        {/* Separator Dot */}
        {quality !== 'ANALYZING' && quality !== 'UNKNOWN' && (
          <span style={{ color: 'rgba(255, 255, 255, 0.2)', fontSize: '10px' }}>•</span>
        )}

        {/* BPM Quick Chip */}
        {mix.trackABpm && mix.trackBBpm && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: mix.bpmQuality === 'CLASH' ? '#ff708d' : 'rgba(255, 255, 255, 0.85)',
              background: 'rgba(255, 255, 255, 0.06)',
              padding: '2px 8px',
            }}
          >
            {mix.bpmQuality === 'MATCHING'
              ? mix.isHalfTime
                ? `${mix.trackABpm} ↔ ${mix.trackBBpm}`
                : `${mix.trackABpm} BPM`
              : `${mix.trackABpm} → ${mix.trackBBpm} (${mix.bpmDiff > 0 ? '+' : ''}${Math.round(mix.bpmDiff)} BPM)`}
          </span>
        )}

        {/* Key Quick Chip */}
        {mix.trackAKey && mix.trackBKey && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: mix.keyQuality === 'OFF_KEY' ? '#ff708d' : 'rgba(255, 255, 255, 0.85)',
              background: 'rgba(255, 255, 255, 0.06)',
              padding: '2px 8px',
            }}
          >
            {mix.trackAKey === mix.trackBKey
              ? mix.trackAKey
              : `${mix.trackAKey} → ${mix.trackBKey}`}
          </span>
        )}

        <span
          style={{
            fontSize: '10px',
            color: 'rgba(255, 255, 255, 0.4)',
            marginLeft: '2px',
          }}
        >
          {showDetails ? '▲' : '▼'}
        </span>
      </div>

      {/* Popover / Expandable Details Box */}
      {showDetails && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            width: '380px',
            maxWidth: '90vw',
            background: 'rgba(15, 17, 26, 0.98)',
            border: `1px solid ${borderColor}`,
            padding: '12px 16px',
            boxShadow: `0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px ${badgeColor}33`,
            backdropFilter: 'blur(16px)',
            color: '#fff',
            fontSize: '12px',
            zIndex: 100,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              paddingBottom: '8px',
              marginBottom: '10px',
            }}
          >
            <span style={{ fontWeight: 700, color: badgeColor, fontSize: '13px' }}>
              Transition Guide: {trackA.name} ➔ {trackB.name}
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 6px',
                background: badgeBg,
                color: badgeColor,
                fontWeight: 700,
              }}
            >
              Score: {Math.round(mix.overallScore * 100)}%
            </span>
          </div>

          {/* Key Compatibility Row */}
          <div style={{ marginBottom: '10px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
              }}
            >
              <span style={{ fontWeight: 600, color: '#e0e0e0' }}>Key Match</span>
              <span
                style={{
                  color:
                    mix.keyQuality === 'OFF_KEY'
                      ? '#ff2a5f'
                      : mix.keyQuality === 'SAME_KEY' ||
                          mix.keyQuality === 'RELATIVE_KEY' ||
                          mix.keyQuality === 'ENERGY_BOOST'
                        ? '#00e676'
                        : mix.keyQuality === 'ENERGY_DROP'
                          ? '#ffc857'
                          : '#00e5ff',
                  fontWeight: 700,
                  fontSize: '11px',
                }}
              >
                {mix.keyLabel}
              </span>
            </div>
            <div
              style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '11px',
                lineHeight: '1.4',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '6px 10px',
                border: `1px solid ${
                  mix.keyQuality === 'OFF_KEY'
                    ? '#ff2a5f'
                    : mix.keyQuality === 'SAME_KEY' ||
                        mix.keyQuality === 'RELATIVE_KEY' ||
                        mix.keyQuality === 'ENERGY_BOOST'
                      ? '#00e676'
                      : mix.keyQuality === 'ENERGY_DROP'
                        ? '#ffc857'
                        : '#00e5ff'
                }`,
              }}
            >
              {mix.keyExplanation}
            </div>
          </div>

          {/* BPM Compatibility Row */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
              }}
            >
              <span style={{ fontWeight: 600, color: '#e0e0e0' }}>Tempo Alignment</span>
              <span
                style={{
                  color:
                    mix.bpmQuality === 'CLASH'
                      ? '#ff2a5f'
                      : mix.bpmQuality === 'MATCHING'
                      ? '#00e676'
                      : '#00e5ff',
                  fontWeight: 700,
                  fontSize: '11px',
                }}
              >
                {mix.bpmLabel}
              </span>
            </div>
            <div
              style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '11px',
                lineHeight: '1.4',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '6px 10px',
                border: `1px solid ${
                  mix.bpmQuality === 'CLASH'
                    ? '#ff2a5f'
                    : mix.bpmQuality === 'MATCHING'
                    ? '#00e676'
                    : '#00e5ff'
                }`,
              }}
            >
              {mix.bpmExplanation}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
