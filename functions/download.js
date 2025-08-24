// functions/download.js
import { getStore } from '@netlify/blobs';
import { preflight, json, cors } from './_lib.js';

export default async (request) => {
  const pf = preflight(request); if (pf) return pf;

  const u = new URL(request.url);
  const id = u.searchParams.get('id');
  if (!id || !id.startsWith('audio/')) return json({ error: 'bad id' }, 400);

  const store = getStore({ name: 'bgm-store' });

  let data = await store.get(id);
  let contentType = 'audio/mpeg';

  if (!data) return json({ error: 'not found' }, 404);

  if (data?.body) {
    contentType = data.contentType || contentType;
    data = data.body;
  } else if (data?.arrayBuffer) {
    data = await data.arrayBuffer();
  } else if (data instanceof Uint8Array) {
    data = data.buffer;
  }

  return new Response(data, {
    status: 200,
    headers: {
      ...cors(),
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600'
    }
  });
};