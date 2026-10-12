const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('We could not read this image. Try selecting another file.'));
    image.src = dataUrl;
  });
}

export async function prepareLogoFile(file) {
  if (!file || !file.size) throw new Error('The selected file is empty. Please choose another image.');
  if (file.size > MAX_LOGO_BYTES) throw new Error('The logo exceeds the maximum allowed file size of 5 MB.');
  if (!SUPPORTED_TYPES.includes(file.type)) throw new Error('This file type is not supported. Please upload a PNG, JPG, or WebP image.');
  const sourceDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('We could not read this image. Try selecting another file.'));
    reader.readAsDataURL(file);
  });
  const image = await loadImage(sourceDataUrl);
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('This image has invalid dimensions. Please choose another file.');
  if (image.naturalWidth > 12000 || image.naturalHeight > 12000) throw new Error('This image is too large to use as a logo. Resize it and try again.');
  // Store a normalized PNG data URL so transparency is preserved and PDF support is dependable.
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare this logo. Try another browser or image.');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: image.naturalWidth,
    height: image.naturalHeight,
    name: file.name,
    type: 'image/png',
    originalType: file.type,
    size: file.size,
  };
}

export function fitImageSize(width, height, maxWidth, maxHeight) {
  if (!width || !height) return { width: maxWidth, height: maxHeight };
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return { width: width * scale, height: height * scale };
}

export const LOGO_MAX_BYTES = MAX_LOGO_BYTES;
