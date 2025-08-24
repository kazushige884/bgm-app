// functions/debug-exists.js
import { getStore } from '@netlify/blobs';
import { preflight, json } from './_lib.js';

export default async (request) => {
  const pf = preflight(request); if (pf) return pf;
  if (request.method !== 'GET') return json({ ok:false, error:'method' }, 405);

  try {
    const u = new URL(request.url);
    const id = u.searchParams.get('id') || '';
    const store = getStore({ name: 'bgm-store' });

    // list() の返り値は環境で微妙に違うため吸収
    const res = await store.list().catch(() => ({}));
    const blobs = Array.isArray(res?.blobs) ? res.blobs
                : Array.isArray(res?.files) ? res.files
                : Array.isArray(res) ? res
                : [];

    const keys = blobs.map(b => b.key || b.name || b.id || '').filter(Boolean);
    const foundInList = keys.includes(id);

    // get() でも直接チェック（返り値の型は何でもOK）
    let foundByGet = false;
    try {
      const got = await store.get(id);
      foundByGet = !!got;
    } catch (_) {}

    return json({
      ok: true,
      id,
      foundInList,
      foundByGet,
      count: keys.length,
      sample: keys.slice(0, 10), // 多すぎると重いので先頭だけ
    });
  } catch (err) {
    return json({ ok:false, error: String(err?.message || err) }, 500);
  }
};