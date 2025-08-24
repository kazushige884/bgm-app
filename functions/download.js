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
      return json({ ok:false, error:'bad-id', siteId: process.env.NETLIFY_SITE_ID || null }, 400);
    }

    const store = getStore({ name: 'bgm-store-v2' }); // ← 統一名に合わせてください

    // ---- 診断：list で存在可否 ----
    let listed = false; let count = 0; let sample = [];
    try {
      const res = await store.list().catch(() => ({}));
      const blobs = Array.isArray(res?.blobs) ? res.blobs
                  : Array.isArray(res?.files) ? res.files
                  : Array.isArray(res) ? res
                  : [];
      const keys = blobs.map(b => b.key || b.name || b.id || '').filter(Boolean);
      listed = keys.includes(id);
      count = keys.length;
      sample = keys.slice(0, 5);
    } catch {}

    const toAB = async (x) => {
      if (!x) return null;
      if (x instanceof ArrayBuffer) return x;
      if (x instanceof Uint8Array) return x.buffer;
      if (typeof x.arrayBuffer === 'function') return await x.arrayBuffer(); // Blob/Response対応
      if (x.body) {
        const b = x.body;
        if (b instanceof ArrayBuffer) return b;
        if (b instanceof Uint8Array) return b.buffer;
        if (typeof b.arrayBuffer === 'function') return await b.arrayBuffer();
      }
      return null;
    };

    let buf = null;
    let ct = 'audio/mpeg';
    let total;

    // 0) オプションなしの get（あなたの環境で通る可能性が高い）
    try {
      const any = await store.get(id);
      if (any) {
        const ab = await toAB(any);
        if (ab) {
          buf = ab;
          if (any && typeof any === 'object') {
            ct = any.contentType || ct;
            total = Number(any.size || any?.metadata?.size || 0) || undefined;
          }
        }
      }
    } catch {}

    // 1) arrayBuffer 明示
    if (!buf) {
      try {
        const a = await store.get(id, { type: 'arrayBuffer' });
        if (a) {
          const ab = await toAB(a);
          if (ab) {
            buf = ab;
            if (a && typeof a === 'object') {
              ct = a.contentType || ct;
              total = Number(a.size || a?.metadata?.size || 0) || undefined;
            }
          }
        }
      } catch {}
    }

    // 2) blob
    if (!buf) {
      try {
        const b = await store.get(id, { type: 'blob' });
        if (b) {
          const ab = await toAB(b);
          if (ab) {
            buf = ab;
            if (b && typeof b === 'object') {
              ct = b.contentType || ct;
              total = Number(b.size || b?.metadata?.size || 0) || total;
            }
          }
        }
      } catch {}
    }

    // 3) stream
    if (!buf) {
      try {
        const s = await store.get(id, { type: 'stream' });
        if (s && s.body) {
          ct = s.contentType || ct;
          total = Number(s.size || 0) || total;
          const chunks = [];
          const reader = s.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
          }
          const merged = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
          let off = 0; for (const c of chunks) { merged.set(c, off); off += c.length; }
          buf = merged.buffer;
        }
      } catch {}
    }

    if (!buf) {
      return json({
        ok: false,
        error: 'not-found-by-download',
        id,
        listed,
        count,
        sample,
        siteId: process.env.NETLIFY_SITE_ID || null
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
    return json({ ok:false, error:'download-error', message:String(err?.message || err), siteId: process.env.NETLIFY_SITE_ID || null }, 500);
  }
};