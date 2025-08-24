import { getStore } from '@netlify/blobs';
import { preflight, json } from './_lib.js';

export default async (request) => {
  const pf = preflight(request); if (pf) return pf;
  if (request.method !== 'POST') return json({ error: 'method' }, 405);

  const form = await request.formData();
  const file = form.get('file');
  if (!file) return json({ error: 'no file' }, 400);

  const type = String(file.type || '');
  if (!/^audio\//.test(type)) return json({ error: 'type' }, 400);

  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.byteLength > 50 * 1024 * 1024) return json({ error: 'too large' }, 400);

  const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] || '.mp3').toLowerCase();
  const stamp = new Date().toISOString().replace(/[:.]/g, '');
  const key = `audio/${stamp}-${Math.random().toString(36).slice(2)}${ext}`;

  const store = getStore({ name: 'bgm-store' });
  await store.set(key, buf, {
    contentType: type || 'audio/mpeg',
    metadata: { title: file.name, size: String(buf.byteLength), uploadedAt: new Date().toISOString() },
    addRandomSuffix: false,
    visibility: 'public'
  });

  const url = await store.getPublicUrl(key);
  return json({ ok: true, id: key, url, title: file.name, size: buf.byteLength, date: new Date().toISOString() });
};