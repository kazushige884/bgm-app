import { getStore } from '@netlify/blobs';
import { preflight, json } from './_lib.js';

export default async (request) => {
  const pf = preflight(request); if (pf) return pf;
  if (request.method !== 'GET') return json({ error: 'method' }, 405);

  const store = getStore({ name: 'bgm-store' });
  const { blobs } = await store.list({ prefix: 'audio/' });

  const items = await Promise.all((blobs || []).map(async b => ({
    id: b.key,
    title: b.key.split('/').pop(),
    size: b.size,
    date: b.createdAt,
    url: `/.netlify/functions/download?id=${encodeURIComponent(b.key)}`
  })));

  // 新しい順
  items.sort((a, b) => (a.date < b.date ? 1 : -1));

  return json({ ok: true, items });
};