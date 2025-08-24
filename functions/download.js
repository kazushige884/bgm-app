// functions/download.js
import { getStore } from '@netlify/blobs';
import { preflight, cors, json } from './_lib.js';

export default async (request) => {
  const pf = preflight(request);
  if (pf) return pf;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id || !id.startsWith('audio/')) {
      return new Response('bad id', { status: 400, headers: cors() });
    }

    const store = getStore({ name: 'bgm-store' });

    // 返り型の違いを全部 ArrayBuffer に正規化
    const toAB = async (x) => {
      if (!x) return null;
      if (x instanceof ArrayBuffer) return x;
      if (x instanceof Uint8Array) return x.buffer;
      if (typeof x.arrayBuffer === 'function') return await x.arrayBuffer(); // Blob/Response 互換
      if (x.body) { // { body, contentType?, size? }
        const b = x.body;
        if (b instanceof ArrayBuffer) return b;
        if (b instanceof Uint8Array) return b.buffer;
        if (typeof b.arrayBuffer === 'function') return await b.arrayBuffer();
      }
      return null;
    };

    let ct = 'audio/mpeg';
    let total = undefined;

    // まず通常 get
    let got = await store.get(id);
    if (got && typeof got === 'object') {
      ct = got.contentType || ct;
      total = Number(got.size || got?.metadata?.size || 0) || undefined;
    }
    let buf = await toAB(got);

    // ダメなら stream で再取得 → ArrayBuffer へ集約
    if (!buf) {
      try {
        const streamed = await store.get(id, { type: 'stream' });
        if (streamed && streamed.body) {
          ct = streamed.contentType || ct;
          total = Number(streamed.size || 0) || total;
          const chunks = [];
          const reader = streamed.body.getReader();
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
      } catch {}
    }

    if (!buf) {
      return new Response('not found', { status: 404, headers: cors() });
    }

    const full = total ?? buf.byteLength;
    const base = {
      ...cors(),
      'Content-Type': ct,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    };

    // Range 対応（duration 表示のため重要）
    const range = request.headers.get('Range'); // 例: "bytes=0-"
    if (range) {
      const m = range.match(/bytes=(\d*)-(\d*)/);
      let start = Number(m?.[1] || 0);
      let end = Number(m?.[2] || (full - 1));
      if (!Number.isFinite(start)) start = 0;
      if (!Number.isFinite(end)) end = full - 1;
      start = Math.max(0, Math.min(start, full - 1));
      end = Math.max(start, Math.min(end, full - 1));

      const chunk = buf.slice(start, end + 1);
      return new Response(chunk, {
        status: 206,
        headers: {
          ...base,
          'Content-Length': String(chunk.byteLength),
          'Content-Range': `bytes ${start}-${end}/${full}`,
        },
      });
    }

    // 全体返却
    return new Response(buf, {
      status: 200,
      headers: { ...base, 'Content-Length': String(full) },
    });
  } catch (err) {
    return json({ ok:false, error:'download error', message:String(err?.message || err) }, 500);
  }
};