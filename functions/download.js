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

    // SDKやランタイムの違いによる返り値の差を吸収
    let data = await store.get(id); // 返り値は環境により Response/Blob/ArrayBuffer/Uint8Array 相当
    let contentType = 'audio/mpeg';

    if (!data) return json({ error: 'not found' }, 404);

    if (data?.body) {
      // { body, contentType } 形式
      contentType = data.contentType || contentType;
      data = data.body; // ArrayBuffer
    } else if (typeof data.arrayBuffer === 'function') {
      // Blob/Response 風
      data = await data.arrayBuffer();
    } else if (data instanceof Uint8Array) {
      data = data.buffer;
    } else if (!(data instanceof ArrayBuffer)) {
      // 想定外の型は文字列化して返さない（404扱いでも可）
      return json({ error: 'unsupported type' }, 500);
    }

    return new Response(data, {
      status: 200,
      headers: {
        ...cors(),
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (err) {
    return json({
      ok: false,
      errorType: err?.name || 'Error',
      errorMessage: String(err?.message || err)
    }, 500);
  }
};