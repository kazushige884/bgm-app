// functions/download.js
import { getStore } from '@netlify/blobs';
import { preflight, cors, json } from './_lib.js';

export default async (request) => {
  // CORS / OPTIONS
  const pf = preflight(request);
  if (pf) return pf;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id || !id.startsWith('audio/')) {
      return new Response('bad id', { status: 400, headers: cors() });
    }

    const store = getStore({ name: 'bgm-store' });

    // ---- 1) まずは汎用 get(id) で取得（環境により戻り型が違う） ----
    let got = await store.get(id); // 返り値の形は色々: null | {body, contentType, size} | Blob/Response | ArrayBuffer | Uint8Array
    if (!got) return new Response('not found', { status: 404, headers: cors() });

    // ---- 2) ArrayBuffer に正規化 ----
    let contentType = 'audio/mpeg';
    let total = undefined;
    let buf;

    const ensureArrayBuffer = async (x) => {
      if (!x) return null;
      if (x instanceof ArrayBuffer) return x;
      if (x instanceof Uint8Array) return x.buffer;
      if (typeof x.arrayBuffer === 'function') return await x.arrayBuffer(); // Blob/Response 互換
      if (x.body) {
        // { body, contentType?, size? }
        contentType = x.contentType || contentType;
        total = Number(x.size || 0) || undefined;
        const b = x.body;
        if (b instanceof ArrayBuffer) return b;
        if (b instanceof Uint8Array) return b.buffer;
        if (typeof b.arrayBuffer === 'function') return await b.arrayBuffer();
      }
      // 最後の手段：文字列ならバイナリ化不可 → エラー
      return null;
    };

    buf = await ensureArrayBuffer(got);
    if (!buf) {
      // 一部環境では get(id, { type:'stream' }) が取れることもある
      try {
        const streamed = await store.get(id, { type: 'stream' });
        if (streamed && streamed.body) {
          contentType = streamed.contentType || contentType;
          total = Number(streamed.size || 0) || undefined;
          // stream → ArrayBuffer に吸収
          const chunks = [];
          const reader = streamed.body.getReader();
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
          }
          const merged = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
          let off = 0;
          for (const c of chunks) { merged.set(c, off); off += c.length; }
          buf = merged.buffer;
        }
      } catch (_) {}
    }

    if (!buf) {
      return new Response('not found', { status: 404, headers: cors() });
    }

    // サイズ判定（上で total が未確定ならここで決定）
    const fullLength = total ?? buf.byteLength;

    // ---- 3) Range 対応 ----
    const baseHeaders = {
      ...cors(),
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    };

    const range = request.headers.get('Range'); // 例: "bytes=0-"
    if (range) {
      const m = range.match(/bytes=(\d*)-(\d*)/);
      let start = Number(m?.[1] || 0);
      let end = Number(m?.[2] || (fullLength - 1));
      if (!Number.isFinite(start) || isNaN(start)) start = 0;
      if (!Number.isFinite(end) || isNaN(end)) end = fullLength - 1;
      start = Math.max(0, Math.min(start, fullLength - 1));
      end = Math.max(start, Math.min(end, fullLength - 1));

      const chunk = buf.slice(start, end + 1);
      return new Response(chunk, {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Length': String(chunk.byteLength),
          'Content-Range': `bytes ${start}-${end}/${fullLength}`,
        },
      });
    }

    // ---- 4) 全体返却 ----
    return new Response(buf, {
      status: 200,
      headers: {
        ...baseHeaders,
        'Content-Length': String(fullLength),
      },
    });
  } catch (err) {
    return json(
      { ok: false, error: 'download error', message: String(err?.message || err) },
      500
    );
  }
};