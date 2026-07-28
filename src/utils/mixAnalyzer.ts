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
  | 'ENERGY_DROP'
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
  overallScore: number; // 0 to 1 — mixability for UI badges
  /** Score used by auto-reorder; includes mild journey-direction bias. */
  orderingScore: number;
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
  /** Signed BPM delta: trackB − trackA (0 when half/double-time aligned). */
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

/** Shortest signed Camelot step from a → b on the 1–12 wheel (−5…+6). */
function camelotStep(from: number, to: number): number {
  let step = (to - from + 12) % 12;
  if (step > 6) step -= 12;
  return step;
}

function formatSignedBpm(delta: number): string {
  if (Math.abs(delta) < 0.05) return '0 BPM';
  const rounded = Math.round(delta);
  return `${rounded > 0 ? '+' : ''}${rounded} BPM`;
}

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

function emptyAnalyzingResult(): MixCompatibility {
  return {
    quality: 'ANALYZING',
    overallScore: 0,
    orderingScore: 0,
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

export function analyzeMixCompatibility(
  trackA?: { bpm?: number; camelot?: string; keyLabel?: string; analyzing?: boolean },
  trackB?: { bpm?: number; camelot?: string; keyLabel?: string; analyzing?: boolean }
): MixCompatibility {
  if (trackA?.analyzing || trackB?.analyzing) {
    return emptyAnalyzingResult();
  }

  const bpmA = trackA?.bpm;
  const bpmB = trackB?.bpm;

  const keyInfoA = parseCamelot(trackA?.camelot, trackA?.keyLabel);
  const keyInfoB = parseCamelot(trackB?.camelot, trackB?.keyLabel);

  // --- Key (directional Camelot) ---
  let keyQuality: KeyMatchQuality = 'UNKNOWN';
  let keyLabel = 'Key Info Missing';
  let keyExplanation = 'Track key not available';
  let keyScore = 0.5;
  let camelotDir = 0; // +1 up wheel, -1 down, 0 flat/unknown

  if (keyInfoA && keyInfoB) {
    const codeA = keyInfoA.code;
    const codeB = keyInfoB.code;
    const n1 = keyInfoA.number;
    const n2 = keyInfoB.number;
    const l1 = keyInfoA.letter;
    const l2 = keyInfoB.letter;
    const step = camelotStep(n1, n2);
    const absStep = Math.abs(step);
    camelotDir = Math.sign(step);

    if (codeA === codeB) {
      keyQuality = 'SAME_KEY';
      keyScore = 1.0;
      keyLabel = `Same Key (${codeA})`;
      keyExplanation = `Exact key match (${codeA}). Harmonic blending will be flawless.`;
      camelotDir = 0;
    } else if (n1 === n2 && l1 !== l2) {
      keyQuality = 'RELATIVE_KEY';
      keyScore = 0.95;
      keyLabel = `Relative Key (${codeA} ↔ ${codeB})`;
      keyExplanation = `Relative Major/Minor pair. Seamless transition with rich harmonic contrast.`;
      camelotDir = 0;
    } else if (l1 === l2 && absStep === 1) {
      keyQuality = 'ADJACENT_KEY';
      keyScore = step > 0 ? 0.92 : 0.88;
      keyLabel = `Adjacent Key (${codeA} → ${codeB})`;
      keyExplanation =
        step > 0
          ? `Harmonic +1 on the Camelot Wheel (${codeA} → ${codeB}). Classic DJ blend with a slight energy lift.`
          : `Harmonic −1 on the Camelot Wheel (${codeA} → ${codeB}). Smooth blend with a softer landing.`;
    } else if (l1 !== l2 && absStep === 1) {
      if (step > 0) {
        keyQuality = 'ENERGY_BOOST';
        keyScore = 0.82;
        keyLabel = `Energy Boost (${codeA} → ${codeB})`;
        keyExplanation = `Diagonal Camelot lift (${codeA} → ${codeB}). Ideal for building floor energy.`;
      } else {
        keyQuality = 'ENERGY_DROP';
        keyScore = 0.75;
        keyLabel = `Energy Drop (${codeA} → ${codeB})`;
        keyExplanation = `Diagonal Camelot drop (${codeA} → ${codeB}). Compatible mood shift — good for cooling the floor.`;
      }
    } else if (l1 === l2 && absStep === 2) {
      keyQuality = 'KEY_SHIFT';
      keyScore = 0.55;
      keyLabel = `2-Step Shift (${codeA} → ${codeB})`;
      keyExplanation = `2-step key shift. Noticeable pitch change — best used on breakdowns or with EQ cuts.`;
    } else {
      keyQuality = 'OFF_KEY';
      keyScore = 0.18;
      keyLabel = `Off Key (${codeA} → ${codeB})`;
      keyExplanation = `Keys ${codeA} and ${codeB} clash. Prefer a cut/drop over a long harmonic blend.`;
    }
  }

  // --- BPM ---
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
      bpmDiff = 0;
    } else {
      bpmDiff = bpmB - bpmA;
    }

    const absDiff = isHalfTime ? minHalfDiff : Math.abs(bpmDiff);
    const pct = (absDiff / bpmA) * 100;
    const signedLabel = formatSignedBpm(isHalfTime ? 0 : bpmDiff);

    if (absDiff <= 1.5) {
      bpmQuality = 'MATCHING';
      bpmScore = 1.0;
      bpmLabel = isHalfTime
        ? `Half/Double Tempo Match (${bpmA} ↔ ${bpmB} BPM)`
        : `Matching Tempo (${bpmA} BPM)`;
      bpmExplanation = isHalfTime
        ? `Tempos align at half/double time (${bpmA} ↔ ${bpmB}). Syncable, but feel/genre may still differ.`
        : `Tempos are aligned (${signedLabel} gap). Zero pitch adjustment required.`;
    } else if (absDiff <= 5 || pct <= 4) {
      bpmQuality = 'SIMILAR';
      bpmScore = 0.8;
      bpmLabel = `Similar Tempo (${bpmA} → ${bpmB} BPM, ${signedLabel})`;
      bpmExplanation = `Close tempo gap (${signedLabel}). Smooth beatmatch with minor pitch fader adjust.`;
    } else if (absDiff <= 9 || pct <= 7) {
      bpmQuality = 'COMPATIBLE';
      bpmScore = 0.5;
      bpmLabel = `Manageable Gap (${bpmA} → ${bpmB} BPM, ${signedLabel})`;
      bpmExplanation = `Moderate tempo gap (${signedLabel}). Pitch adjust or a gradual tempo ramp advised.`;
    } else {
      bpmQuality = 'CLASH';
      bpmScore = 0.12;
      bpmLabel = `Tempo Clash (${bpmA} vs ${bpmB} BPM, ${signedLabel})`;
      bpmExplanation = `Large tempo mismatch (${signedLabel}). Best mixed with cuts or quick drops, not long blends.`;
    }
  }

  const hasBpm = Boolean(bpmA && bpmB);
  const hasKey = Boolean(keyInfoA && keyInfoB);

  if (!hasBpm && !hasKey) {
    return {
      quality: 'UNKNOWN',
      overallScore: 0.5,
      orderingScore: 0.5,
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

  if (!hasBpm) {
    return {
      quality: 'UNKNOWN',
      overallScore: keyScore * 0.7,
      orderingScore: keyScore * 0.7,
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

  // Combined mixability — key slightly weighted, but clashes hard-cap the grade
  let overallScore = keyScore * 0.55 + bpmScore * 0.45;

  if (bpmQuality === 'CLASH' || keyQuality === 'OFF_KEY') {
    overallScore = Math.min(overallScore, 0.55);
  }
  if (bpmQuality === 'CLASH' && keyQuality === 'OFF_KEY') {
    overallScore = Math.min(overallScore, 0.32);
  }
  // Same key cannot rescue a tempo clash into "Compatible"
  if (bpmQuality === 'CLASH') {
    overallScore = Math.min(overallScore, 0.52);
  }
  if (keyQuality === 'OFF_KEY' && bpmQuality !== 'MATCHING') {
    overallScore = Math.min(overallScore, 0.48);
  }

  // Half/double-time: beatmatchable but don't oversell as a perfect blend
  if (isHalfTime && overallScore > 0.78) {
    overallScore = 0.78;
  }

  let quality: OverallMixQuality = 'TRICKY';
  let badgeText = 'Tricky Mix';
  let badgeColor = '#ff2a5f';
  let badgeBg = 'rgba(255, 42, 95, 0.12)';
  let borderColor = 'rgba(255, 42, 95, 0.35)';

  const canBeExcellent =
    keyScore >= 0.8 &&
    bpmScore >= 0.8 &&
    !isHalfTime &&
    keyQuality !== 'OFF_KEY' &&
    bpmQuality !== 'CLASH';

  if (canBeExcellent && overallScore >= 0.84) {
    quality = 'EXCELLENT';
    badgeText = 'Perfect Mix';
    badgeColor = '#00e676';
    badgeBg = 'rgba(0, 230, 118, 0.12)';
    borderColor = 'rgba(0, 230, 118, 0.35)';
  } else if (
    overallScore >= 0.65 &&
    bpmQuality !== 'CLASH' &&
    keyQuality !== 'OFF_KEY'
  ) {
    quality = 'GOOD';
    badgeText = 'Compatible Pair';
    badgeColor = '#00e5ff';
    badgeBg = 'rgba(0, 229, 255, 0.12)';
    borderColor = 'rgba(0, 229, 255, 0.35)';
  }

  // Ordering score: mixability + mild preference for rising energy / tempo
  let orderingScore = overallScore;
  if (hasBpm && !isHalfTime) {
    if (bpmDiff > 0 && bpmDiff <= 6) orderingScore += 0.06;
    else if (bpmDiff > 6 && bpmDiff <= 10) orderingScore += 0.02;
    else if (bpmDiff < -4 && bpmDiff >= -10) orderingScore -= 0.035;
    else if (bpmDiff < -10) orderingScore -= 0.06;
  }
  if (camelotDir > 0) orderingScore += 0.04;
  else if (camelotDir < 0) orderingScore -= 0.02;
  if (keyQuality === 'ENERGY_BOOST') orderingScore += 0.02;
  if (keyQuality === 'ENERGY_DROP') orderingScore -= 0.015;

  return {
    quality,
    overallScore,
    orderingScore,
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

function pathTransitionScore(path: number[], matrix: number[][]): number {
  let score = 0;
  for (let k = 0; k < path.length - 1; k++) {
    score += matrix[path[k]][path[k + 1]];
  }
  return score;
}

/** Prefer sets that generally climb BPM early, with optional ease-down near the end. */
function journeyBonus(
  path: number[],
  tracks: { bpm?: number }[]
): number {
  const bpms: number[] = [];
  for (const idx of path) {
    const bpm = tracks[idx]?.bpm;
    if (typeof bpm === 'number' && bpm > 0) bpms.push(bpm);
  }
  if (bpms.length < 3) return 0;

  let rises = 0;
  let falls = 0;
  for (let i = 0; i < bpms.length - 1; i++) {
    const d = bpms[i + 1] - bpms[i];
    if (d > 0.5) rises++;
    else if (d < -0.5) falls++;
  }

  let bonus = (rises - falls) * 0.035;

  // Mild reward for starting in the lower half of the set's BPM range
  const minBpm = Math.min(...bpms);
  const maxBpm = Math.max(...bpms);
  const range = maxBpm - minBpm;
  if (range > 4) {
    const startNorm = (bpms[0] - minBpm) / range;
    bonus += (0.5 - startNorm) * 0.08;
  }

  return bonus;
}

/**
 * Optimizes the setlist order to maximize transition compatibility (BPM & Key)
 * while preferring a rising energy/tempo journey.
 * Uses nearest-neighbor construction with asymmetric 2-opt refinement.
 */
export function optimizeSetlistOrder<
  T extends { bpm?: number; camelot?: string; keyLabel?: string; analyzing?: boolean }
>(tracks: T[]): T[] {
  if (tracks.length <= 2) return [...tracks];

  const validTracks: { track: T; index: number }[] = [];
  const pendingTracks: T[] = [];

  tracks.forEach((t) => {
    if (t.analyzing || (!t.bpm && !t.camelot && !t.keyLabel)) {
      pendingTracks.push(t);
    } else {
      validTracks.push({ track: t, index: validTracks.length });
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
      ).orderingScore;
    }
  }

  const trackRefs = validTracks.map((v) => v.track);

  let bestPath: number[] = [];
  let bestTotalScore = -Infinity;

  for (let start = 0; start < n; start++) {
    const path = [start];
    const visited = new Set<number>([start]);

    while (path.length < n) {
      const current = path[path.length - 1];
      let bestNext = -1;
      let maxScore = -Infinity;

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

    // Asymmetric 2-opt: account for all reversed internal edges
    let improved = true;
    let guard = 0;
    while (improved && guard < 40) {
      improved = false;
      guard++;
      for (let i = 0; i < path.length - 2; i++) {
        for (let j = i + 2; j < path.length; j++) {
          // Current edges along i→…→j (and j→j+1 when present)
          let currentDelta = 0;
          for (let k = i; k < j; k++) {
            currentDelta += matrix[path[k]][path[k + 1]];
          }
          if (j + 1 < path.length) {
            currentDelta += matrix[path[j]][path[j + 1]];
          }

          // After reversing path[i+1..j]: i→j, j→…→i+1, then i+1→j+1
          let newDelta = matrix[path[i]][path[j]];
          for (let k = j; k > i + 1; k--) {
            newDelta += matrix[path[k]][path[k - 1]];
          }
          if (j + 1 < path.length) {
            newDelta += matrix[path[i + 1]][path[j + 1]];
          }

          if (newDelta > currentDelta + 0.001) {
            const segment = path.slice(i + 1, j + 1).reverse();
            path.splice(i + 1, j - i, ...segment);
            improved = true;
          }
        }
      }
    }

    const total =
      pathTransitionScore(path, matrix) + journeyBonus(path, trackRefs);

    if (total > bestTotalScore) {
      bestTotalScore = total;
      bestPath = [...path];
    }
  }

  const reorderedValid = bestPath.map((idx) => validTracks[idx].track);
  return [...reorderedValid, ...pendingTracks];
}
