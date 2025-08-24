// functions/remove.js
import { getStore } from '@netlify/blobs';
import { preflight, json } from './_lib.js';

export default async (request) => {
  const pf = preflight(request); if (pf) return pf;

  // POST でも DELETE でも受け付ける
  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return json({ error: 'method' }, 405);
  }

  try {
    let ids = [];

    // ① JSON { ids: [...] }
    if (/application\/json/i.test(request.headers.get('Content-Type') || '')) {
      const body = await request.json().catch(() => null);
      if (Array.isArray(body?.ids)) ids = body.ids;
      if (!ids.length && typeof body?.id === 'string') ids = [body.id];
    }

    // ② x-www-form-urlencoded / multipart: ids=... or id=...
    if (!ids.length && /^(application\/x-www-form-urlencoded|multipart\/form-data)/i.test(request.headers.get('Content-Type') || '')) {
      const form = await request.formData().catch(() => null);
      if (form) {
        const v = form.get('ids') || form.get('id');
        if (v) ids = String(v).split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    // ③ クエリ ?ids=... でもOK
    if (!ids.length) {
      const u = new URL(request.url);
      const qp = u.searchParams.get('ids') || u.searchParams.get('id');
      if (qp) ids = String(qp).split(',').map(s => s.trim()).filter(Boolean);
    }

    if (!ids.length) return json({ ok:false, error:'no-ids' }, 400);

    const store = getStore({ name: 'bgm-store-v2' });

    const delOne = async (key) => {
      if (!String(key).startsWith('audio/')) return;
      if (typeof store.delete === 'function') return store.delete(key);
      if (typeof store.del === 'function') return store.del(key);
      // フォールバック（通常は不要）
      return store.set(key, new Uint8Array(0), { contentType: 'application/octet-stream' });
    };

    for (const id of ids) { await delOne(id); }

    return json({ ok:true, deleted: ids.length });
  } catch (err) {
    return json({ ok:false, errorType: err?.name || 'Error', errorMessage: String(err?.message || err) }, 500);
  }
};