// functions/upload.js
import { getStore } from '@netlify/blobs';
import { preflight, json } from './_lib.js';

export default async (request) => {
  const pf = preflight(request); if (pf) return pf;
  if (request.method !== 'POST') return json({ error: 'method' }, 405);

  try {
    const form = await request.formData().catch(() => null);
    if (!form) return json({ ok:false, error:'no-form' }, 400);

    const file = form.get('file');
    if (!file) return json({ ok:false, error:'no-file' }, 400);

    const name = String(file.name || 'audio.mp3');
    const ext  = (name.match(/\.[a-z0-9]+$/i)?.[0] || '.mp3').toLowerCase();
    const typeFromPicker = String(file.type || '');

    const guessByExt = (e) => {
      if (e === '.mp3') return 'audio/mpeg';
      if (e === '.m4a') return 'audio/mp4';
      if (e === '.wav') return 'audio/wav';
      if (e === '.ogg') return 'audio/ogg';
      return 'application/octet-stream';
    };
    const contentType = typeFromPicker || guessByExt(ext);

    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.byteLength <= 0) return json({ ok:false, error:'empty-file' }, 400);
    if (buf.byteLength > 50 * 1024 * 1024) return json({ ok:false, error:'too-large' }, 400);

    // 例: audio/2025-08-24T081846564Z-xxxxx.mp3
    const stamp = new Date().toISOString().replace(/[:.]/g, '');
    const key = `audio/${stamp}-${Math.random().toString(36).slice(2)}${ext}`;

    const store = getStore({ name: 'bgm-store' });
    await store.set(key, buf, {
      contentType,
      metadata: {
        title: name,
        size: String(buf.byteLength),
        uploadedAt: new Date().toISOString(),
      },
      addRandomSuffix: false,
    });

    const url = `/.netlify/functions/download?id=${encodeURIComponent(key)}`;

    return json({
      ok: true,
      id: key,
      url,
      title: name,
      size: buf.byteLength,
      date: new Date().toISOString(),
    });
  } catch (err) {
    return json({ ok:false, errorType: err?.name || 'Error', errorMessage: String(err?.message || err) }, 500);
  }
};