// functions/remove.js
import { getStore } from '@netlify/blobs';
import { preflight, json, STORE_NAME } from './_lib.js';

export default async (request) => {
  const pf = preflight(request); if (pf) return pf;
  if (request.method !== 'POST') return json({ ok:false, error:'method' }, 405);

  try {
    const store = getStore({ name: STORE_NAME });
    const body = await request.json().catch(()=> ({}));
    let ids = body?.ids;

    // 単一でも許容
    if (!Array.isArray(ids)) ids = body?.id ? [body.id] : [];

    // バリデーション
    ids = ids.filter(id => typeof id === 'string' && id.startsWith('audio/'));

    if (ids.length === 0) return json({ ok:false, error:'no-ids' }, 400);

    const results = [];
    for (const id of ids) {
      try {
        await store.delete(id);
        results.push({ id, ok:true });
      } catch (e) {
        results.push({ id, ok:false, error:String(e?.message || e) });
      }
    }

    return json({ ok:true, results });
  } catch (err) {
    return json({ ok:false, error:String(err?.message || err) }, 500);
  }
};