import type { Track } from '../components/SetlistTable';

const DB_NAME = 'MixAssistantDB';
const DB_VERSION = 1;
const STORE_NAME = 'tracks';
const LOCALSTORAGE_KEY = 'mix_assistant_tracks_meta';

export interface PersistentTrack extends Track {
  _blob?: Blob;
}

export function getAudioMimeType(fileName: string, currentType?: string): string {
  if (currentType && currentType.startsWith('audio/')) {
    return currentType;
  }
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'flac':
      return 'audio/flac';
    case 'm4a':
    case 'aac':
      return 'audio/mp4';
    case 'ogg':
      return 'audio/ogg';
    default:
      return 'audio/mpeg';
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface StoredTrackRecord {
  id: number;
  name: string;
  bpm?: number;
  key?: string;
  scale?: string;
  keyLabel?: string;
  camelot?: string;
  genre?: string;
  peaks?: number[];
  duration?: number;
  audioBlob?: Blob;
}

/**
 * Saves all tracks (metadata + audio blob) to IndexedDB and metadata to localStorage.
 * Synchronous and non-blocking — expects track._blob or track.file to be in memory.
 */
export async function saveTracksToStorage(tracks: PersistentTrack[]): Promise<void> {
  if (!tracks) return;

  if (tracks.length === 0) {
    await clearAllTracksFromStorage();
    return;
  }

  try {
    // 1. Save JSON metadata for immediate localStorage fallback
    const metaList = tracks.map((t) => ({
      id: t.id,
      name: t.name,
      bpm: t.bpm,
      key: t.key,
      scale: t.scale,
      keyLabel: t.keyLabel,
      camelot: t.camelot,
      genre: t.genre,
      peaks: t.peaks,
      duration: t.duration,
    }));
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(metaList));

    // 2. Prepare Blob records synchronously without calling async file.arrayBuffer() or fetch()
    const records: StoredTrackRecord[] = [];

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const blob: Blob | undefined = track._blob || track.file;

      records.push({
        id: track.id,
        name: track.name,
        bpm: track.bpm,
        key: track.key,
        scale: track.scale,
        keyLabel: track.keyLabel,
        camelot: track.camelot,
        genre: track.genre,
        peaks: track.peaks,
        duration: track.duration,
        audioBlob: blob,
      });
    }

    // 3. Write records synchronously to IndexedDB
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.clear();
    for (const record of records) {
      store.put(record);
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    // Save order indices
    const trackOrder = tracks.map((t) => t.id);
    localStorage.setItem('mix_assistant_track_order', JSON.stringify(trackOrder));
  } catch (err) {
    console.error('Failed to save tracks to storage:', err);
  }
}

/**
 * Loads all saved tracks from IndexedDB (with localStorage fallback).
 */
export async function loadTracksFromStorage(): Promise<PersistentTrack[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const records: StoredTrackRecord[] = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    const savedOrderJson = localStorage.getItem('mix_assistant_track_order');
    let orderMap: Record<number, number> = {};
    if (savedOrderJson) {
      try {
        const orderArr: number[] = JSON.parse(savedOrderJson);
        orderArr.forEach((id, idx) => {
          orderMap[id] = idx;
        });
      } catch (e) {
        console.warn('Failed to parse track order', e);
      }
    }

    let tracks: PersistentTrack[] = [];

    if (records && records.length > 0) {
      tracks = records.map((rec) => {
        let url: string | undefined;
        let blob: Blob | undefined = rec.audioBlob;

        if (blob) {
          const mimeType = getAudioMimeType(rec.name, blob.type);
          if (blob.type !== mimeType) {
            blob = new Blob([blob], { type: mimeType });
          }
          url = URL.createObjectURL(blob);
        }

        return {
          id: rec.id,
          name: rec.name,
          url,
          _blob: blob,
          file: blob
            ? new File([blob], rec.name, { type: getAudioMimeType(rec.name, blob.type) })
            : undefined,
          bpm: rec.bpm,
          key: rec.key,
          scale: rec.scale,
          keyLabel: rec.keyLabel,
          camelot: rec.camelot,
          genre: rec.genre,
          peaks: rec.peaks,
          duration: rec.duration,
          analyzing: false,
        };
      });
    } else {
      // Fallback to localStorage metadata if IndexedDB returned no records
      const metaJson = localStorage.getItem(LOCALSTORAGE_KEY);
      if (metaJson) {
        const metaList = JSON.parse(metaJson);
        if (Array.isArray(metaList) && metaList.length > 0) {
          tracks = metaList.map((m) => ({
            id: m.id,
            name: m.name,
            bpm: m.bpm,
            key: m.key,
            scale: m.scale,
            keyLabel: m.keyLabel,
            camelot: m.camelot,
            genre: m.genre,
            peaks: m.peaks,
            duration: m.duration,
            analyzing: false,
          }));
        }
      }
    }

    // Sort by saved order
    tracks.sort((a, b) => {
      const orderA = orderMap[a.id] ?? a.id;
      const orderB = orderMap[b.id] ?? b.id;
      return orderA - orderB;
    });

    return tracks;
  } catch (err) {
    console.error('Failed to load tracks from storage:', err);
    return [];
  }
}

/**
 * Deletes a single track by ID.
 */
export async function deleteTrackFromStorage(id: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);

    // Update localStorage metadata
    const metaJson = localStorage.getItem(LOCALSTORAGE_KEY);
    if (metaJson) {
      const metaList = JSON.parse(metaJson);
      if (Array.isArray(metaList)) {
        const updated = metaList.filter((m) => m.id !== id);
        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(updated));
      }
    }
  } catch (err) {
    console.error('Failed to delete track:', err);
  }
}

/**
 * Clears all tracks from storage.
 */
export async function clearAllTracksFromStorage(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    localStorage.removeItem(LOCALSTORAGE_KEY);
    localStorage.removeItem('mix_assistant_track_order');
  } catch (err) {
    console.error('Failed to clear tracks:', err);
  }
}
