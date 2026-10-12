import React, { useRef, useState } from 'react';
import { Button, Icon } from './common';
import { prepareLogoFile } from '../utils/logo';

export default function LogoUploader({ logoDataUrl, logoMeta, onChange, onError, compact = false, label = 'Business logo' }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState('');
  async function handleFile(file) {
    setLocalError('');
    if (!file) return;
    setBusy(true);
    try {
      const normalized = await prepareLogoFile(file);
      onChange?.(normalized);
    } catch (error) {
      const message = error?.message || 'The logo could not be uploaded.';
      setLocalError(message);
      onError?.(message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }
  return <div>
    <input ref={inputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleFile(event.target.files?.[0])} aria-label="Choose business logo file" />
    <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); handleFile(event.dataTransfer.files?.[0]); }} className={`rounded-2xl border border-dashed p-4 transition ${dragging ? 'border-primary bg-primary/5' : 'border-slate-300 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-950/60'} ${compact ? '' : 'sm:p-5'}`}>
      {logoDataUrl ? <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-24 min-w-28 items-center justify-center rounded-xl border border-slate-200 bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%),linear-gradient(45deg,#f1f5f9_25%,white_25%,white_75%,#f1f5f9_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px] p-3 dark:border-slate-700 dark:bg-slate-900"><img src={logoDataUrl} alt={`${label} preview`} className="max-h-20 max-w-36 object-contain" /></div>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{logoMeta?.name || 'Custom business logo'}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{logoMeta?.width && logoMeta?.height ? `${logoMeta.width} × ${logoMeta.height} px` : 'Image ready'}{logoMeta?.size ? ` · ${(logoMeta.size / 1024).toFixed(0)} KB` : ''}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saved locally in this browser. Transparent PNG backgrounds are preserved.</p>
          <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="secondary" icon="Upload" onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? 'Processing…' : 'Replace logo'}</Button><Button size="sm" variant="ghost" icon="Trash2" onClick={() => onChange?.(null)}>Remove</Button></div>
        </div>
      </div> : <div className="flex flex-col items-center text-center">
        <div className="mb-3 rounded-xl bg-white p-3 text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300"><Icon name="ImagePlus" size={22} /></div>
        <p className="text-sm font-semibold text-slate-800 dark:text-white">Upload your business logo.</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-500 dark:text-slate-400">Add your own branding to invoices and quotations. PNG, JPG, or WebP · up to 5 MB.</p>
        <Button className="mt-4" size="sm" icon="Upload" onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? 'Processing image…' : 'Choose logo'}</Button>
        <p className="mt-3 text-[11px] text-slate-400">You can also drag an image file here.</p>
      </div>}
    </div>
    {localError && <div role="alert" className="mt-2 flex gap-2 text-xs text-red-600"><Icon name="AlertCircle" size={15} /><span>{localError}</span></div>}
  </div>;
}
