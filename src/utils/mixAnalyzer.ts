export interface TrackKeyInfo {
  code: string; // e.g. "8A"
  number: number; // 1-12
  letter: 'A' | 'B';
}

export type KeyMatchQuality = 
  | 'SAME_KEY'
  | 'RELATIVE_KEY'
  | 'ADJACENT_KEY'
  | 'ENERGY_BOOST'
  | 'KEY_SHIFT'
  | 'OFF_KEY'
  | 'UNKNOWN';

export type BpmMatchQuality =
  | 'MATCHING'
  | 'SIMILAR'
  | 'COMPATIBLE'
  | 'CLASH'
  | 'UNKNOWN';

export type OverallMixQuality = 'EXCELLENT' | 'GOOD' | 'TRICKY' | 'ANALYZING' | 'UNKNOWN';

export interface MixCompatibility {
  quality: OverallMixQuality;
  overallScore: number; // 0 to 1
  badgeText: string;
  badgeColor: string;
  badgeBg: string;
  borderColor: string;

  keyQuality: KeyMatchQuality;
  keyLabel: string;
  keyExplanation: string;
  keyScore: number;

  bpmQuality: BpmMatchQuality;
  bpmLabel: string;
  bpmExplanation: string;
  bpmDiff: number;
  bpmScore: number;
  isHalfTime: boolean;

  trackAKey?: string;
  trackBKey?: string;
  trackABpm?: number;
  trackBBpm?: number;
}

// Fallback lookup if camelot string isn't pre-computed
const KEY_TO_CAMELOT: Record<string, string> = {
  'C major': '8B', 'A minor': '8A',
  'G major': '9B', 'E minor': '9A',
  'D major': '10B', 'B minor': '10A',
  'A major': '11B', 'F# minor': '11A', 'Gb minor': '11A',
  'E major': '12B', 'C# minor': '12A', 'Db minor': '12A',
  'B major': '1B', 'G# minor': '1A', 'Ab minor': '1A',
  'F# major': '2B', 'Gb major': '2B', 'D# minor': '2A', 'Eb minor': '2A',
  'C# major': '3B', 'Db major': '3B', 'A# minor': '3A', 'Bb minor': '3A',
  'G# major': '4B', 'Ab major': '4B', 'F minor': '4A',
  'D# major': '5B', 'Eb major': '5B', 'C minor': '5A',
  'A# major': '6B', 'Bb major': '6B', 'G minor': '6A',
  'F major': '7B', 'D minor': '7A',
};

export function parseCamelot(camelotStr?: string, keyLabel?: string): TrackKeyInfo | null {
  let str = camelotStr;
  if (!str && keyLabel && KEY_TO_CAMELOT[keyLabel]) {
    str = KEY_TO_CAMELOT[keyLabel];
  }
  if (!str) return null;

  const match = str.trim().match(/^(\d{1,2})([ABab])$/);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  const letter = match[2].toUpperCase() as 'A' | 'B';

  if (num < 1 || num > 12) return null;

  return {
    code: `${num}${letter}`,
    number: num,
    letter,
  };
}

export function analyzeMixCompatibility(
  trackA?: { bpm?: number; camelot?: string; keyLabel?: string; analyzing?: boolean },
  trackB?: { bpm?: number; camelot?: string; keyLabel?: string; analyzing?: boolean }
): MixCompatibility {
  if (trackA?.analyzing || trackB?.analyzing) {
    return {
      quality: 'ANALYZING',
      overallScore: 0,
      badgeText: 'Analyzing compatibility…',
      badgeColor: '#00e5ff',
      badgeBg: 'rgba(0, 229, 255, 0.1)',
      borderColor: 'rgba(0, 229, 255, 0.3)',
      keyQuality: 'UNKNOWN',
      keyLabel: 'Analyzing…',
      keyExplanation: 'Waiting for key analysis to complete',
      keyScore: 0,
      bpmQuality: 'UNKNOWN',
      bpmLabel: 'Analyzing…',
      bpmExplanation: 'Waiting for tempo analysis to complete',
      bpmDiff: 0,
      bpmScore: 0,
      isHalfTime: false,
    };
  }

  const bpmA = trackA?.bpm;
  const bpmB = trackB?.bpm;

  const keyInfoA = parseCamelot(trackA?.camelot, trackA?.keyLabel);
  const keyInfoB = parseCamelot(trackB?.camelot, trackB?.keyLabel);

  // Analyze Key
  let keyQuality: KeyMatchQuality = 'UNKNOWN';
  let keyLabel = 'Key Info Missing';
  let keyExplanation = 'Track key not available';
  let keyScore = 0.5;

  if (keyInfoA && keyInfoB) {
    const codeA = keyInfoA.code;
    const codeB = keyInfoB.code;

    const n1 = keyInfoA.number;
    const n2 = keyInfoB.number;
    const l1 = keyInfoA.letter;
    const l2 = keyInfoB.letter;

    const numDiff = (n1 - n2 + 12) % 12;

    if (codeA === codeB) {
      keyQuality = 'SAME_KEY';
      keyScore = 1.0;
      keyLabel = `Same Key (${codeA})`;
      keyExplanation = `Exact key match (${codeA}). Harmonic blending will be flawless.`;
    } else if (n1 === n2 && l1 !== l2) {
      keyQuality = 'RELATIVE_KEY';
      keyScore = 0.95;
      keyLabel = `Relative Key (${codeA} ↔ ${codeB})`;
      keyExplanation = `Relative Major/Minor pair. Seamless transition with rich harmonic contrast.`;
    } else if (l1 === l2 && (numDiff === 1 || numDiff === 11)) {
      keyQuality = 'ADJACENT_KEY';
      keyScore = 0.9;
      keyLabel = `Adjacent Key (${codeA} ↔ ${codeB})`;
      keyExplanation = `Harmonic 1-step move on Camelot Wheel (${codeA} to ${codeB}). Classic DJ blend.`;
    } else if (l1 !== l2 && (numDiff === 1 || numDiff === 11)) {
      keyQuality = 'ENERGY_BOOST';
      keyScore = 0.8;
      keyLabel = `Energy Boost (${codeA} ↔ ${codeB})`;
      keyExplanation = `Diagonal Camelot move. Ideal for building floor energy during transition.`;
    } else if (l1 === l2 && (numDiff === 2 || numDiff === 10)) {
      keyQuality = 'KEY_SHIFT';
      keyScore = 0.6;
      keyLabel = `2-Step Shift (${codeA} ↔ ${codeB})`;
      keyExplanation = `2-step key shift. Noticeable pitch shift, best used on breakdowns.`;
    } else {
      keyQuality = 'OFF_KEY';
      keyScore = 0.2;
      keyLabel = `Off Key (${codeA} ↔ ${codeB})`;
      keyExplanation = `Keys ${codeA} and ${codeB} clash. Harmonic collision risk during long overlaps.`;
    }
  }

  // Analyze BPM
  let bpmQuality: BpmMatchQuality = 'UNKNOWN';
  let bpmLabel = 'BPM Missing';
  let bpmExplanation = 'Track tempo not available';
  let bpmDiff = 0;
  let bpmScore = 0.5;
  let isHalfTime = false;

  if (bpmA && bpmB) {
    const rawDiff = Math.abs(bpmA - bpmB);
    const halfDiff1 = Math.abs(bpmA - bpmB * 2);
    const halfDiff2 = Math.abs(bpmA * 2 - bpmB);
    const minHalfDiff = Math.min(halfDiff1, halfDiff2);

    if (minHalfDiff < rawDiff && minHalfDiff <= 3) {
      isHalfTime = true;
      bpmDiff = minHalfDiff;
    } else {
      bpmDiff = rawDiff;
    }

    const pct = (bpmDiff / bpmA) * 100;

    if (bpmDiff <= 1.5) {
      bpmQuality = 'MATCHING';
      bpmScore = 1.0;
      bpmLabel = isHalfTime
        ? `Half/Double Tempo Match (${bpmA} ↔ ${bpmB} BPM)`
        : `Matching Tempo (${bpmA} BPM)`;
      bpmExplanation = `Tempos are aligned (${bpmDiff.toFixed(0)} BPM diff). Zero pitch adjustment required.`;
    } else if (bpmDiff <= 5 || pct <= 4) {
      bpmQuality = 'SIMILAR';
      bpmScore = 0.8;
      bpmLabel = `Similar Tempo (${bpmA} ➔ ${bpmB} BPM, ${bpmDiff > 0 ? '+' : ''}${bpmDiff.toFixed(0)} BPM)`;
      bpmExplanation = `Close tempo gap (${bpmDiff.toFixed(0)} BPM diff). Smooth beatmatch with minor pitch fader adjust.`;
    } else if (bpmDiff <= 9 || pct <= 7) {
      bpmQuality = 'COMPATIBLE';
      bpmScore = 0.55;
      bpmLabel = `Manageable Gap (${bpmA} ➔ ${bpmB} BPM, +${bpmDiff.toFixed(0)} BPM)`;
      bpmExplanation = `Moderate tempo gap (+${bpmDiff.toFixed(0)} BPM). Pitch adjustment or gradual tempo ramp advised.`;
    } else {
      bpmQuality = 'CLASH';
      bpmScore = 0.15;
      bpmLabel = `Tempo Clash (${bpmA} vs ${bpmB} BPM, +${bpmDiff.toFixed(0)} BPM)`;
      bpmExplanation = `Large tempo mismatch (${bpmDiff.toFixed(0)} BPM gap). Best mixed using cuts or quick drops.`;
    }
  }

  // Handle missing metrics
  if (!bpmA || !bpmB || !keyInfoA || !keyInfoB) {
    if (!bpmA || !bpmB) {
      return {
        quality: 'UNKNOWN',
        overallScore: 0.5,
        badgeText: 'Partial Analysis',
        badgeColor: '#aaaaaa',
        badgeBg: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        keyQuality,
        keyLabel,
        keyExplanation,
        keyScore,
        bpmQuality,
        bpmLabel,
        bpmExplanation,
        bpmDiff,
        bpmScore,
        isHalfTime,
        trackAKey: keyInfoA?.code,
        trackBKey: keyInfoB?.code,
        trackABpm: bpmA,
        trackBBpm: bpmB,
      };
    }
  }

  // Combined score formula
  const overallScore = keyScore * 0.55 + bpmScore * 0.45;

  let quality: OverallMixQuality = 'TRICKY';
  let badgeText = 'Tricky Mix';
  let badgeColor = '#ff2a5f';
  let badgeBg = 'rgba(255, 42, 95, 0.12)';
  let borderColor = 'rgba(255, 42, 95, 0.35)';

  if (overallScore >= 0.82) {
    quality = 'EXCELLENT';
    badgeText = 'Perfect Mix';
    badgeColor = '#00e676';
    badgeBg = 'rgba(0, 230, 118, 0.12)';
    borderColor = 'rgba(0, 230, 118, 0.35)';
  } else if (overallScore >= 0.6) {
    quality = 'GOOD';
    badgeText = 'Compatible Pair';
    badgeColor = '#00e5ff';
    badgeBg = 'rgba(0, 229, 255, 0.12)';
    borderColor = 'rgba(0, 229, 255, 0.35)';
  }

  return {
    quality,
    overallScore,
    badgeText,
    badgeColor,
    badgeBg,
    borderColor,
    keyQuality,
    keyLabel,
    keyExplanation,
    keyScore,
    bpmQuality,
    bpmLabel,
    bpmExplanation,
    bpmDiff,
    bpmScore,
    isHalfTime,
    trackAKey: keyInfoA?.code,
    trackBKey: keyInfoB?.code,
    trackABpm: bpmA,
    trackBBpm: bpmB,
  };
}

/**
 * Optimizes the setlist order to maximize transition compatibility (BPM & Key) between consecutive tracks.
 * Uses Nearest-Neighbor construction with 2-Opt local search refinement.
 */
export function optimizeSetlistOrder<
  T extends { bpm?: number; camelot?: string; keyLabel?: string; analyzing?: boolean }
>(tracks: T[]): T[] {
  if (tracks.length <= 2) return [...tracks];

  const validTracks: { track: T; index: number }[] = [];
  const pendingTracks: T[] = [];

  tracks.forEach((t, idx) => {
    if (t.analyzing || (!t.bpm && !t.camelot && !t.keyLabel)) {
      pendingTracks.push(t);
    } else {
      validTracks.push({ track: t, index: idx });
    }
  });

  if (validTracks.length <= 1) return [...tracks];

  const n = validTracks.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      matrix[i][j] = analyzeMixCompatibility(
        validTracks[i].track,
        validTracks[j].track
      ).overallScore;
    }
  }

  let bestPath: number[] = [];
  let bestTotalScore = -1;

  for (let start = 0; start < n; start++) {
    const path = [start];
    const visited = new Set<number>([start]);

    while (path.length < n) {
      const current = path[path.length - 1];
      let bestNext = -1;
      let maxScore = -1;

      for (let next = 0; next < n; next++) {
        if (!visited.has(next)) {
          const score = matrix[current][next];
          if (score > maxScore) {
            maxScore = score;
            bestNext = next;
          }
        }
      }

      if (bestNext !== -1) {
        visited.add(bestNext);
        path.push(bestNext);
      } else {
        break;
      }
    }

    let pathScore = 0;
    for (let k = 0; k < path.length - 1; k++) {
      pathScore += matrix[path[k]][path[k + 1]];
    }

    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < path.length - 2; i++) {
        for (let j = i + 2; j < path.length - 1; j++) {
          const currentDelta =
            matrix[path[i]][path[i + 1]] + matrix[path[j]][path[j + 1]];
          const newDelta =
            matrix[path[i]][path[j]] + matrix[path[i + 1]][path[j + 1]];
          if (newDelta > currentDelta + 0.001) {
            const segment = path.slice(i + 1, j + 1).reverse();
            path.splice(i + 1, j - i, ...segment);
            pathScore += newDelta - currentDelta;
            improved = true;
          }
        }
      }
    }

    if (pathScore > bestTotalScore) {
      bestTotalScore = pathScore;
      bestPath = path;
    }
  }

  const reorderedValid = bestPath.map((idx) => validTracks[idx].track);
  return [...reorderedValid, ...pendingTracks];
}

