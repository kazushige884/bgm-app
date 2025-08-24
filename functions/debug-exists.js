// functions/debug-exists.js
import { getStore } from '@netlify/blobs';
import { json } from './_lib.js';

export default async (request) => {
  try {
    const u = new URL(request.url);
    const id = u.searchParams.get('id') || '';

    const store = getStore({ name: 'bgm-store-v2' });
    const res = await store.list().catch(() => ({}));
    const blobs = Array.isArray(res?.blobs) ? res.blobs
                : Array.isArray(res?.files) ? res.files
                : Array.isArray(res) ? res
                : [];
    const keys = blobs.map(b => b.key || b.name || b.id || '').filter(Boolean);

    let foundByGet = false;
    try { foundByGet = !!(await store.get(id)); } catch {}

    return json({
      ok: true,
      id,
      foundInList: keys.includes(id),
      foundByGet,
      count: keys.length,
      sample: keys.slice(0, 5),
      siteId: process.env.NETLIFY_SITE_ID || null
    });
  } catch (e) {
    return json({ ok:false, error:String(e) }, 500);
  }
};