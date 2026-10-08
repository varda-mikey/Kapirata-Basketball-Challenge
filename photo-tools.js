// Prepare readable phone-review JPEGs before transferring them to the media bridge.
export async function optimizePhoto(file, kind = 'receipt') {
  if (!file || !file.type.startsWith('image/')) throw new Error('Please choose a JPG, PNG, or other supported photo.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Photo exceeds 25 MB. Please take a smaller photo.');
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Cannot read this photo. Please take a JPG photo instead.'));
      image.src = url;
    });
    let edge = kind === 'receipt' ? 1600 : 1280;
    const target = (kind === 'receipt' ? 240 : 180) * 1024;
    const canvas = document.createElement('canvas');
    let blob;
    for (let round = 0; round < 3; round++) {
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.72, 0.62]) {
        blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (!blob) throw new Error('Cannot prepare this photo. Please choose another photo.');
        if (blob.size <= target) break;
      }
      if (blob.size <= target) break;
      edge = Math.round(edge * 0.85);
    }
    if (blob.size > 500 * 1024) throw new Error('Photo is still too large. Crop to the receipt or subject and try again.');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {type:'image/jpeg'});
  } finally { URL.revokeObjectURL(url); }
}
