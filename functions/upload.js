// functions/upload.js
import { getStore } from '@netlify/blobs';
import { preflight, json } from './_lib.js';

export default async (request) => {
  // CORS/OPTIONS
  const pf = preflight(request); if (pf) return pf;
  if (request.method !== 'POST') return json({ error: 'method' }, 405);

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file) return json({ error: 'no file' }, 400);

    // ---- MIME が空の端末（iOS/Safari など）でも通す ----
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

    // 50MB制限（必要に応じて調整）
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.byteLength > 50 * 1024 * 1024) {
      return json({ error: 'too large (limit 50MB)' }, 400);
    }

    // 保存キー：ISOスタンプ（記号なし）+ ランダム + 元拡張子
    // 例：audio/2025-08-24T075337923Z-abc123.mp3
    const stamp = new Date().toISOString().replace(/[:.]/g, ''); // 2025-08-24T075337923Z
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

    // 再生URLは download 関数経由
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
    return json(
      { ok: false, errorType: err?.name || 'Error', errorMessage: String(err?.message || err) },
      500
    );
  }
};