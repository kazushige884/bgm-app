// functions/list.js
import { getStore } from '@netlify/blobs';
import { preflight, json } from './_lib.js';

export default async (request) => {
  const pf = preflight(request); if (pf) return pf;
  if (request.method !== 'GET') return json({ ok:false, error:'method' }, 405);

  try {
    const store = getStore({ name: 'bgm-store-v2' });
    const res = await store.list().catch(() => ({}));

    const blobs = Array.isArray(res?.blobs) ? res.blobs
                : Array.isArray(res?.files) ? res.files
                : Array.isArray(res) ? res
                : [];

    const items = [];
    for (const b of blobs) {
      const key = b.key || b.name || b.id || '';
      if (!key || !key.startsWith('audio/')) continue;

      const size = Number(b.size ?? b?.metadata?.size ?? 0) || undefined;
      const date = b.uploadedAt || b?.metadata?.uploadedAt || undefined;
      const title = b?.metadata?.title || key.split('/').pop();

      items.push({ id: key, title, size, date });
    }

    items.sort((a,b)=>{
      const ad = a.date || a.id; const bd = b.date || b.id;
      return ad < bd ? 1 : ad > bd ? -1 : 0;
    });

    return json({ ok:true, items });
  } catch (err) {
    return json({ ok:false, error: String(err?.message || err) }, 500);
  }
};