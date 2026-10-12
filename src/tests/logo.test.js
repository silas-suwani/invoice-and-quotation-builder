import { describe, expect, it } from 'vitest';
import { prepareLogoFile, LOGO_MAX_BYTES } from '../utils/logo';

describe('logo upload validation', () => {
  it('rejects unsupported image formats with a useful message', async () => {
    const file = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' });
    await expect(prepareLogoFile(file)).rejects.toThrow(/PNG, JPG, or WebP/i);
  });

  it('rejects oversized logos before attempting to decode them', async () => {
    const file = new File([new Uint8Array(LOGO_MAX_BYTES + 1)], 'large.png', { type: 'image/png' });
    await expect(prepareLogoFile(file)).rejects.toThrow(/5 MB/i);
  });

  it('rejects empty files', async () => {
    const file = new File([], 'empty.png', { type: 'image/png' });
    await expect(prepareLogoFile(file)).rejects.toThrow(/empty/i);
  });
});
