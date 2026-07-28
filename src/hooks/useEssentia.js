import { useEffect, useRef, useState } from 'react';
import { Essentia, EssentiaWASM } from 'essentia.js';

// Camelot wheel lookup — maps Essentia's (key, scale) output to
// the notation DJs actually use for harmonic mixing.
const CAMELOT = {
  'C major': '8B', 'A minor': '8A',
  'G major': '9B', 'E minor': '9A',
  'D major': '10B', 'B minor': '10A',
  'A major': '11B', 'F# minor': '11A',
  'E major': '12B', 'C# minor': '12A',
  'B major': '1B', 'G# minor': '1A',
  'F# major': '2B', 'D# minor': '2A',
  'C# major': '3B', 'A# minor': '3A',
  'G# major': '4B', 'F minor': '4A',
  'D# major': '5B', 'C minor': '5A',
  'A# major': '6B', 'G minor': '6A',
  'F major': '7B', 'D minor': '7A',
};

export function useEssentia() {
  const essentiaRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function initEssentia() {
      try {
        let wasmModule = EssentiaWASM;
        if (typeof EssentiaWASM === 'function') {
          wasmModule = await EssentiaWASM();
        }
        if (wasmModule && wasmModule.EssentiaWASM) {
          wasmModule = wasmModule.EssentiaWASM;
        }
        essentiaRef.current = new Essentia(wasmModule);
        setReady(true);
      } catch (err) {
        console.error('Failed to initialize Essentia:', err);
      }
    }
    initEssentia();
  }, []);

  /**
   * Decodes a File/Blob and runs BPM + key extraction.
   * Returns { bpm, key, scale, camelot }.
   */
  async function analyzeFile(file) {
    if (!essentiaRef.current) throw new Error('Essentia not loaded yet');

    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Essentia's algorithms expect mono Float32 PCM at the buffer's native rate.
    const monoSamples = audioBuffer.numberOfChannels > 1
      ? mixToMono(audioBuffer)
      : audioBuffer.getChannelData(0);

    const essentia = essentiaRef.current;
    const vectorSignal = essentia.arrayToVector(monoSamples);

    // RhythmExtractor2013 gives a solid overall BPM estimate.
    const rhythm = essentia.RhythmExtractor2013(vectorSignal);
    const bpm = Math.round(rhythm.bpm);

    // KeyExtractor gives key, scale (major/minor), and a confidence score.
    const keyResult = essentia.KeyExtractor(vectorSignal);
    const key = keyResult.key;
    const scale = keyResult.scale;
    const keyLabel = `${key} ${scale}`;
    const camelot = CAMELOT[keyLabel] || null;

    const peaks = extractPeaks(audioBuffer, 600);
    const duration = audioBuffer.duration;
    const genre = detectGenre({ bpm, scale, peaks });

    // Clean up WASM vector memory
    try {
      if (vectorSignal && vectorSignal.delete) {
        vectorSignal.delete();
      }
    } catch (e) {
      // Ignore cleanup error if already freed
    }

    audioCtx.close();

    return { bpm, key, scale, keyLabel, camelot, peaks, duration, genre };
  }

  return { ready, analyzeFile };
}

function detectGenre({ bpm, scale, peaks }) {
  const avgEnergy = peaks.reduce((a, b) => a + b, 0) / (peaks.length || 1);
  const peakMax = Math.max(...peaks, 0.01);
  const energyRatio = avgEnergy / peakMax;

  if (bpm >= 165) {
    return 'Drum & Bass';
  } else if (bpm >= 138 && bpm < 165) {
    return energyRatio > 0.5 ? 'Dubstep / Hardstyle' : 'Trance / Techno';
  } else if (bpm >= 120 && bpm < 138) {
    if (scale === 'minor' && energyRatio > 0.45) return 'Techno / Deep House';
    if (scale === 'major') return 'House / EDM';
    return 'Electro House';
  } else if (bpm >= 105 && bpm < 120) {
    return scale === 'major' ? 'Disco / Funk' : 'Deep House / Nu-Disco';
  } else if (bpm >= 85 && bpm < 105) {
    return energyRatio > 0.5 ? 'Pop / Dance' : 'Hip-Hop / R&B';
  } else if (bpm >= 60 && bpm < 85) {
    return scale === 'minor' ? 'Trap / Hip-Hop' : 'Chillout / R&B';
  } else {
    return 'Ambient / Downtempo';
  }
}

function extractPeaks(audioBuffer, sampleCount = 600) {
  const channelData = audioBuffer.getChannelData(0);
  const step = Math.floor(channelData.length / sampleCount);
  const peaks = [];
  let maxPeak = 0.0001;

  for (let i = 0; i < sampleCount; i++) {
    const start = i * step;
    let max = 0;
    for (let j = 0; j < step; j++) {
      const val = Math.abs(channelData[start + j] || 0);
      if (val > max) max = val;
    }
    peaks.push(max);
    if (max > maxPeak) maxPeak = max;
  }

  return peaks.map((p) => Math.min(1, p / maxPeak));
}

function mixToMono(audioBuffer) {
  const length = audioBuffer.length;
  const out = new Float32Array(length);
  const channels = audioBuffer.numberOfChannels;
  for (let c = 0; c < channels; c++) {
    const data = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) out[i] += data[i] / channels;
  }
  return out;
}

