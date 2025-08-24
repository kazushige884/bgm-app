// functions/list.js
import { getStore } from '@netlify/blobs';
import { preflight, json, STORE_NAME } from './_lib.js';

export default async (request) => {
  const pf = preflight(request); if (pf) return pf;
  if (request.method !== 'GET') return json({ ok:false, error:'method' }, 405);

  try {
    const store = getStore({ name: STORE_NAME });
    const res = await store.list().catch(() => ({}));
    const blobs = Array.isArray(res?.blobs) ? res.blobs
                : Array.isArray(res?.files) ? res.files
                : Array.isArray(res) ? res
                : [];

    // audio/ プレフィックスのみに限定
    const items = blobs
      .map(b => ({
        id: b.key || b.name || b.id || '',
        key: b.key || b.name || b.id || '',
        size: Number(b.size || b.bytes || b.length || 0) || 0,
        date: b.updatedAt || b.uploadedAt || b.lastModified || null,
        title: b?.metadata?.title || null,
      }))
      .filter(x => x.key.startsWith('audio/'))
      // 新しい順
      .sort((a, b) => (b.key > a.key ? 1 : -1));

    return json({ ok:true, items });
  } catch (err) {
    return json({ ok:false, error:String(err?.message || err) }, 500);
  }
};