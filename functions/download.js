// functions/download.js
import { getStore } from '@netlify/blobs';
import { preflight } from './_lib.js';

export default async (request) => {
  const pf = preflight(request);
  if (pf) return pf;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id || !id.startsWith('audio/')) {
    return new Response('bad id', { status: 400 });
  }

  try {
    const store = getStore({ name: 'bgm-store' });
    const blob = await store.get(id);

    if (!blob) {
      return new Response('not found', { status: 404 });
    }

    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    return new Response('error: ' + err.message, { status: 500 });
  }
};