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

    // ★ 全関数と同じストア名に統一 ★
    const store = getStore({ name: 'bgm-store-v2' });

    // キーは audio/ 固定（download/list/debug もこの前提）
    const now = new Date();
    const ts = now.toISOString().replace(/\.\d+Z$/, 'Z').replace(/[:]/g, '');
    const rand = Math.random().toString(36).slice(2, 12);
    const safeName = (file.name || 'audio.mp3').replace(/[^\w.\-]+/g, '_');
    const key = `audio/${ts}-${rand}.mp3`;

    const contentType = file.type || 'audio/mpeg';
    const ab = await file.arrayBuffer();

    // 書き込み
    await store.set(key, ab, {
      contentType,
      metadata: {
        title: safeName,
        size: ab.byteLength,
        uploadedAt: now.toISOString(),
      },
    });

    // === 診断：直後に get / list を確認 ===
    let gotOk = false;
    try { gotOk = !!(await store.get(key)); } catch {}

    let listed = false, count = 0, sample = [];
    try {
      const res = await store.list().catch(() => ({}));
      const blobs = Array.isArray(res?.blobs) ? res.blobs
                  : Array.isArray(res?.files) ? res.files
                  : Array.isArray(res) ? res
                  : [];
      const keys = blobs.map(b => b.key || b.name || b.id || '').filter(Boolean);
      listed = keys.includes(key);
      count = keys.length;
      sample = keys.slice(0, 10);
    } catch {}

    return json({
      ok: true,
      id: key,
      title: safeName,
      size: ab.byteLength,
      date: now.toISOString(),
      diag: {
        gotOk,     // get で即読めたか
        listed,    // list に出たか
        count,     // list件数
        sample     // 先頭のキー（確認用）
      }
    });
  } catch (err) {
    return json({ ok:false, error: String(err?.message || err) }, 500);
  }
};