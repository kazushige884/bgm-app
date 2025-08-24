// functions/list.js
import { getStore } from '@netlify/blobs';
import { preflight, json, STORE_NAME } from './_lib.js';

// 旧ID（タイムスタンプ-ファイル名）から表示用タイトルを推定
function deriveTitleFromKey(key) {
  try {
    const base = (key || '').split('/').pop() || '';
    // 例: 2025-08-25T03-50-12-345Z-春のBGM.mp3 → 春のBGM.mp3
    const m = base.match(/^(\d{4}-\d{2}-\d{2}T[\d-]+Z-)(.+)$/);
    if (m && m[2]) return m[2];
    return base || key || '';
  } catch {
    return key || '';
  }
}

export default async (request) => {
  const pf = preflight(request); if (pf) return pf;
  if (request.method !== 'GET') return json({ ok:false, error:'method' }, 405);

  try {
    const store = getStore({ name: STORE_NAME });

    // audio/ のみ列挙（混入防止）
    const res = await store.list({ prefix: 'audio/' }).catch(() => ({}));
    const blobs = Array.isArray(res?.blobs) ? res.blobs
                : Array.isArray(res?.files) ? res.files
                : Array.isArray(res) ? res
                : [];

    const items = blobs.map(b => {
      const key  = b.key || b.name || b.id || '';
      const meta = b.metadata || {};

      // 表示用タイトル：metadata.title 優先 → 旧キーから推定
      const title = meta.title || deriveTitleFromKey(key);

      // サイズ：metadata.size 優先 → BLOBのサイズ系
      const size =
        Number(meta.size ?? b.size ?? b.bytes ?? b.length ?? 0) || 0;

      // 日付（ISO文字列）：metadata.uploaded 優先 → BLOBの更新系 → null
      const date =
        meta.uploaded || b.updatedAt || b.uploadedAt || b.lastModified || null;

      return { id: key, key, title, size, date };
    })
    // 念のため audio/ 以外は除外
    .filter(x => String(x.key).startsWith('audio/'))
    // 新しい順（date優先、無ければキーで近似）
    .sort((a, b) => {
      const at = a.date ? Date.parse(a.date) : 0;
      const bt = b.date ? Date.parse(b.date) : 0;
      if (at !== bt) return bt - at;
      return (b.key > a.key) ? 1 : (b.key < a.key ? -1 : 0);
    });

    return json({ ok:true, items });
  } catch (err) {
    return json({ ok:false, error:String(err?.message || err) }, 500);
  }
};