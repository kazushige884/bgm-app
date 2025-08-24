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

    // 返り値（環境差）を ArrayBuffer に正規化
    let data = await store.get(id);
    let contentType = 'audio/mpeg';
    if (!data) return json({ error: 'not found' }, 404);

    if (data?.body) {                 // { body, contentType }
      contentType = data.contentType || contentType;
      data = data.body;               // ArrayBuffer
    } else if (typeof data?.arrayBuffer === 'function') {
      data = await data.arrayBuffer();// Blob/Response風
    } else if (data instanceof Uint8Array) {
      data = data.buffer;
    } else if (!(data instanceof ArrayBuffer)) {
      return json({ error: 'unsupported type' }, 500);
    }

    const total = data.byteLength;
    const range = request.headers.get('Range'); // 例: "bytes=0-1023"

    // 基本ヘッダ（CORS + キャッシュ + Range可）
    const baseHeaders = {
      ...cors(),
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    };

    if (range) {
      const m = range.match(/bytes=(\d*)-(\d*)/);
      let start = Number(m?.[1] || 0);
      let end   = Number(m?.[2] || (total - 1));
      if (!Number.isFinite(start) || isNaN(start)) start = 0;
      if (!Number.isFinite(end)   || isNaN(end))   end   = total - 1;
      start = Math.max(0, Math.min(start, total - 1));
      end   = Math.max(start, Math.min(end, total - 1));

      const chunk = data.slice(start, end + 1);
      return new Response(chunk, {
        status: 206, // Partial Content
        headers: {
          ...baseHeaders,
          'Content-Length': String(chunk.byteLength),
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Rangeなし（全体）
    return new Response(data, {
      status: 200,
      headers: {
        ...baseHeaders,
        'Content-Length': String(total),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    return json(
      { ok:false, errorType: err?.name || 'Error', errorMessage: String(err?.message || err) },
      500
    );
  }
};