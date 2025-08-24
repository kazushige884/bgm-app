// functions/list.js
import { getStore } from '@netlify/blobs';
import { preflight, json } from './_lib.js';

export default async (request) => {
  const pf = preflight(request); if (pf) return pf;
  if (request.method !== 'GET') return json({ ok:false, error:'method' }, 405);

  try {
    const store = getStore({ name: 'bgm-store' });

    // list() は環境で戻り形が違うことがあるので吸収
    const res = await store.list().catch(() => ({}));
    const blobs = Array.isArray(res?.blobs) ? res.blobs
                : Array.isArray(res?.files) ? res.files
                : Array.isArray(res) ? res
                : [];

    const items = [];
    for (const b of blobs) {
      const key = b.key || b.name || b.id || '';
      if (!key || !String(key).startsWith('audio/')) continue;

      const size = Number(b.size || b?.metadata?.size || 0) || undefined;
      const date = b.uploadedAt || b?.metadata?.uploadedAt || undefined;
      const title = b?.metadata?.title || key.split('/').pop();

      // まず署名付きURLを試す（60秒有効）
      let url = '';
      try{
        if (typeof store.getSignedUrl === 'function') {
          url = await store.getSignedUrl({ key, expires: 60 });
        }
      }catch(_) { /* フォールバックへ */ }

      // 使えない環境なら従来のdownload関数を使用
      if (!url) url = `/.netlify/functions/download?id=${encodeURIComponent(key)}`;

      items.push({ id: key, title, url, size, date });
    }

    // 新しい順に
    items.sort((a,b)=>{
      const ad = a.date || a.id; const bd = b.date || b.id;
      return ad < bd ? 1 : ad > bd ? -1 : 0;
    });

    return json({ ok:true, items });
  } catch (err) {
    return json({ ok:false, errorType: err?.name || 'Error', errorMessage: String(err?.message || err) }, 500);
  }
};