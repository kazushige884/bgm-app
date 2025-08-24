// functions/list.js
import { getStore } from '@netlify/blobs';
import { preflight, json, STORE_NAME } from './_lib.js';

// 旧ファイル（metadata が無い）用の簡易復元：
// key 例: "audio/2025-08-25T03-50-12-345Z-春のBGM.mp3"
//   → 先頭の ISO っぽい接頭辞 + "-" を取り除き、残りをタイトルとする
function deriveTitleFromKey(key) {
  try {
    const base = (key || '').split('/').pop() || '';
    // ISOっぽい先頭（コロン/ピリオドを "-" に置換した形式）+ ハイフン を除去
    // 例: 2025-08-25T03-50-12-345Z-XXXXXXXX
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

    // audio/ 配下だけを取得（パフォーマンスと混入防止）
    const res = await store.list({ prefix: 'audio/' }).catch(() => ({}));
    const blobs = Array.isArray(res?.blobs) ? res.blobs
                : Array.isArray(res?.files) ? res.files
                : Array.isArray(res) ? res
                : [];

    const items = blobs
      .map(b => {
        const key  = b.key || b.name || b.id || '';
        const meta = b.metadata || {};
        // 優先順: metadata.title → キーからの推定
        const title = meta.title || deriveTitleFromKey(key);
        // サイズも metadata.size を優先（無ければ BLOB 側のサイズ系を使用）
        const size = Number(meta.size ?? b.size ?? b.bytes ?? b.length ?? 0) || 0;
        // 日付は metadata.uploaded を優先、無ければ BLOB の最終更新系
        const date = meta.uploaded || b.updatedAt || b.uploadedAt || b.lastModified || null;

        return {
          id: key,         // 内部ID（試聴/削除用）
          key,             // デバッグ用に同じ値も持たせる
          title,           // 画面表示用の“元のファイル名”
          size,            // バイト数（フロントでKB/MBに整形）
          date,            // ISO文字列（フロントで日付表示に整形）
        };
      })
      // 念のため audio/ のみ残す（store.list の prefix で原則絞れている）
      .filter(x => String(x.key).startsWith('audio/'))
      // 新しい順（date が取れなければ key で近似）
      .sort((a, b) => {
        const ad = a.date ? new Date(a.date).getTime() : 0;
        const bd = b.date ? new Date(b.date).getTime() : 0;
        if (ad !== bd) return bd - ad;
        return (b.key > a.key) ? 1 : (b.key < a.key ? -1 : 0);
      });

    return json({ ok:true, items });
  } catch (err) {
    return json({ ok:false, error:String(err?.message || err) }, 500);
  }
};