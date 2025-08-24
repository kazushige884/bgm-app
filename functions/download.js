// functions/download.js
import { getStore } from '@netlify/blobs';
import { preflight, cors, json } from './_lib.js';

export default async (request) => {
  const pf = preflight(request);
  if (pf) return pf;

  try {
    const u = new URL(request.url);
    const id = u.searchParams.get('id');
    if (!id || !id.startsWith('audio/')) {
      return new Response('bad id', { status: 400, headers: cors() });
    }

    const store = getStore({ name: 'bgm-store' });

    // --- list() で存在確認（診断用） ---
    let listed = false; let sample = [];
    try {
      const res = await store.list().catch(() => ({}));
      const blobs = Array.isArray(res?.blobs) ? res.blobs
                  : Array.isArray(res?.files) ? res.files
                  : Array.isArray(res) ? res
                  : [];
      const keys = blobs.map(b => b.key || b.name || b.id || '').filter(Boolean);
      listed = keys.includes(id);
      sample = keys.slice(0, 10);
    } catch {}

    // 返り型を ArrayBuffer に正規化
    const toAB = async (x) => {
      if (!x) return null;
      if (x instanceof ArrayBuffer) return x;
      if (x instanceof Uint8Array) return x.buffer;
      if (typeof x.arrayBuffer === 'function') return await x.arrayBuffer();
      if (x.body) {
        const b = x.body;
        if (b instanceof ArrayBuffer) return b;
        if (b instanceof Uint8Array) return b.buffer;
        if (typeof b.arrayBuffer === 'function') return await b.arrayBuffer();
      }
      return null;
    };

    let ct = 'audio/mpeg';
    let total;

    // ① 通常 get()
    let got = null;
    try {
      got = await store.get(id);
      if (got && typeof got === 'object') {
        ct = got.contentType || ct;
        total = Number(got.size || got?.metadata?.size || 0) || undefined;
      }
    } catch {}

    let buf = await toAB(got);

    // ② ダメなら stream
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
          let off = 0; for (const c of chunks) { merged.set(c, off); off += c.length; }
          buf = merged.buffer;
        }
      } catch {}
    }

    if (!buf) {
      // 404でも詳細JSONで返す（いまはこれを見たい）
      return json({
        ok: false,
        error: 'not-found-by-download',
        id,
        listed,           // list() では見えているか
        triedGet: !!got,  // get(id) が truthy だったか
        sample,
      }, 404);
    }

    const full = total ?? buf.byteLength;
    const base = { ...cors(), 'Content-Type': ct, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };

    const range = request.headers.get('Range');
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

    return new Response(buf, { status: 200, headers: { ...base, 'Content-Length': String(full) } });
  } catch (err) {
    return json({ ok:false, error:'download-error', message:String(err?.message || err) }, 500);
  }
};