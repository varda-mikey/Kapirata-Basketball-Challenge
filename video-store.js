// Short clips stay below Firestore's document limit, including base64 overhead.
export const VIDEO_SECONDS = 5;
export const VIDEO_MAX_BYTES = 700 * 1024;
export const VIDEO_BITRATE = 750000;
export const VIDEO_FPS = 24;
export const VIDEO_LONG_EDGE = 640;

export function videoPayload(base64, blob, settings = {}) {
  if (!blob.size || blob.size > VIDEO_MAX_BYTES) {
    throw new Error('Video is too large to save. Keep this page open and download the backup.');
  }
  if (!/^(video\/webm|video\/mp4)(;.*)?$/.test(blob.type)) {
    throw new Error('Unsupported video format.');
  }
  if (base64.length > Math.ceil(VIDEO_MAX_BYTES / 3) * 4) {
    throw new Error('Video exceeds the save limit.');
  }
  return {
    videoBase64: base64,
    videoMimeType: blob.type,
    videoBytes: blob.size,
    videoDurationSeconds: settings.duration || VIDEO_SECONDS,
    videoWidth: settings.width || null,
    videoHeight: settings.height || null,
    videoUploadStatus: 'saved'
  };
}

export function decodeVideo(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], {type: mimeType || 'video/webm'});
}

function pendingDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('kapirata-video-backup', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('pending');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function pendingVideo(action, value) {
  const db = await pendingDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending', action === 'get' ? 'readonly' : 'readwrite');
    const store = tx.objectStore('pending');
    const request = action === 'get' ? store.get('clip') : action === 'put' ? store.put(value, 'clip') : store.delete('clip');
    let result;
    request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Backup cancelled')); };
  });
}
