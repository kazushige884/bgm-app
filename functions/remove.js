import { getStore } from '@netlify/blobs';
import { preflight, json } from './_lib.js';

export default async (request) => {
  const pf = preflight(request); if (pf) return pf;
  if (request.method !== 'DELETE') return json({ error: 'method' }, 405);

  const u = new URL(request.url);
  const id = u.searchParams.get('id');
  if (!id || !id.startsWith('audio/')) return json({ error: 'bad id' }, 400);

  const store = getStore({ name: 'bgm-store' });
  await store.delete(id);

  return json({ ok: true });
};