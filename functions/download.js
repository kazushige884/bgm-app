// functions/download.js
import { getStore } from '@netlify/blobs';
import { preflight, json, cors } from './_lib.js';

export default async (request) => {
  // CORS/OPTIONS
  const pf = preflight(request); if (pf) return pf;

  try {
    const u = new URL(request.url);
    const id = u.searchParams.get('id');
    if (!id || !id.startsWith('audio/')) {
      return json({ error: 'bad id' }, 400);
    }

    const store = getStore({ name: 'bgm-store' });

    // SDKやランタイム差異を吸収
    let data = await store.get(id); // Response/Blob/ArrayBuffer/Uint8Array 的な何か
    let contentType = 'audio/mpeg';

    if (!data) return json({ error: 'not found' }, 404);

    if (data?.body) {
      // { body, contentType }
      contentType = data.contentType || contentType;
      data = data.body; // ArrayBuffer
    } else if (typeof data?.arrayBuffer === 'function') {
      data = await data.arrayBuffer();
    } else if (data instanceof Uint8Array) {
      data = data.buffer;
    } else if (!(data instanceof ArrayBuffer)) {
      return json({ error: 'unsupported type' }, 500);
    }

    return new Response(data, {
      status: 200,
      headers: {
        ...cors(),
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    return json(
      { ok: false, errorType: err?.name || 'Error', errorMessage: String(err?.message || err) },
      500
    );
  }
};