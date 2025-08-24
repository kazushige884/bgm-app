// functions/geturl.js
import { getStore } from '@netlify/blobs';
import { preflight, json, STORE_NAME } from './_lib.js';

export default async (request) => {
  const pf = preflight(request); if (pf) return pf;
  if (request.method !== 'GET') return json({ ok:false, error:'method' }, 405);

  try {
    const u = new URL(request.url);
    const id = u.searchParams.get('id');
    if (!id || !id.startsWith('audio/')) {
      return json({ ok:false, error:'bad-id' }, 400);
    }

    const store = getStore({ name: STORE_NAME });

    // 署名付きURL（対応している環境だけ）
    let url = '';
    try {
      if (typeof store.getSignedUrl === 'function') {
        // 10分有効
        url = await store.getSignedUrl({ key: id, expires: 600 });
      }
    } catch (e) {
      // ここは握りつぶしてフォールバックへ
    }

    // フォールバック：自前の download 関数
    if (!url) {
      url = `/.netlify/functions/download?id=${encodeURIComponent(id)}`;
    }

    return json({ ok:true, url });
  } catch (err) {
    return json({ ok:false, error:String(err?.message || err) }, 500);
  }
};