// functions/upload.js
import { getStore } from '@netlify/blobs';
import { preflight, json, readMultipartFile, STORE_NAME } from './_lib.js';

export default async (request) => {
  const pf = preflight(request); if (pf) return pf;
  if (request.method !== 'POST') return json({ ok:false, error:'method' }, 405);

  try {
    const file = await readMultipartFile(request, 'file');
    if (!file) return json({ ok:false, error:'no-file' }, 400);

    const safeName = (file.name || 'audio.mp3').replace(/[^\w.\-]+/g, '_');
    const now = new Date();
    const rand = Math.random().toString(36).slice(2, 12);
    // コロンを除去したISO（iOS/Safariの一部でパス扱いが壊れないように）
    const ts = now.toISOString().replace(/\.\d+Z$/, 'Z').replace(/[:]/g, '');
    const key = `audio/${ts}-${rand}.mp3`;

    const ab = await file.arrayBuffer();
    const store = getStore({ name: STORE_NAME });
    await store.set(key, ab, {
      contentType: 'audio/mpeg',
      metadata: { title: safeName, uploadedAt: now.toISOString() }
    });

    // 簡易診断：直後に get と list を試す
    let gotOk = false, listed = false, count = 0, sample = [];
    try { const g = await store.get(key); gotOk = !!g; } catch {}
    try {
      const res = await store.list();
      const blobs = Array.isArray(res?.blobs) ? res.blobs
                  : Array.isArray(res?.files) ? res.files
                  : Array.isArray(res) ? res
                  : [];
      const keys = blobs.map(b => b.key || b.name || b.id || '').filter(Boolean);
      listed = keys.includes(key);
      count = keys.length;
      sample = keys.slice(0, 5);
    } catch {}

    return json({
      ok: true,
      id: key,
      title: safeName,
      size: ab.byteLength,
      date: now.toISOString(),
      diag: { storeName: STORE_NAME, gotOk, listed, count, sample }
    });
  } catch (err) {
    return json({ ok:false, error:String(err?.message || err) }, 500);
  }
};