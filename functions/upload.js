// functions/upload.js
import { getStore } from '@netlify/blobs';
import { preflight, json } from './_lib.js';

export default async (request) => {
  const pf = preflight(request); if (pf) return pf;
  if (request.method !== 'POST') return json({ ok:false, error:'method' }, 405);

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
      return json({ ok:false, error:'no-file' }, 400);
    }

    // ここを全関数で統一（list/download/geturl も 'bgm-store' を使います）
    const store = getStore({ name: 'bgm-store' });

    // キーは audio/ に統一（download も同じ前提で探す）
    const now = new Date();
    const ts = now.toISOString().replace(/\.\d+Z$/, 'Z'); // 2025-08-24T11:48:54Z
    const rand = Math.random().toString(36).slice(2, 12);
    const safeName = (file.name || 'audio.mp3').replace(/[^\w.\-]+/g, '_');
    const key = `audio/${ts}-${rand}.mp3`;

    const contentType = file.type || 'audio/mpeg';
    const ab = await file.arrayBuffer();

    // Blobs に保存（メタデータも付けておく）
    await store.set(key, ab, {
      contentType,
      metadata: {
        title: safeName,
        size: ab.byteLength,
        uploadedAt: now.toISOString(),
      },
    });

    // クライアントは一覧で取り直すのでURLは空でOK（geturlが都度発行）
    return json({
      ok: true,
      id: key,
      title: safeName,
      size: ab.byteLength,
      date: now.toISOString(),
    });
  } catch (err) {
    return json({ ok:false, error: String(err?.message || err) }, 500);
  }
};