// functions/upload.js
import { getStore } from '@netlify/blobs';
import { preflight, json, STORE_NAME } from './_lib.js';

export const config = { bodyParser: false };

export default async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ ok:false, error:'method' }, 405);

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !file.name) {
      return json({ ok:false, error:'no-file' }, 400);
    }

    // ① ファイルメタ
    const origName = file.name;              // 日本語・全角OK
    const mime = file.type || 'audio/mpeg';  // ざっくり
    const size = typeof file.size === 'number' ? file.size : 0;

    // ② まずバイナリを確定させる（streamでハング回避）
    const ab = await file.arrayBuffer();     // ← 重要
    const bytes = new Uint8Array(ab);

    // ③ 既存一覧を一度だけ取得して、重複名を (2)(3)… で回避
    const store = getStore({ name: STORE_NAME });
    const res = await store.list().catch(() => ({}));
    const blobs = Array.isArray(res?.blobs) ? res.blobs
                : Array.isArray(res?.files) ? res.files
                : Array.isArray(res) ? res
                : [];

    // 既存のファイル名（復元後＝decode 済み）集合を作る
    const existingNames = new Set(
      blobs
        .map(b => (b.key || b.name || b.id || ''))
        .filter(k => k.startsWith('audio/'))
        .map(k => decodeURIComponent(k.split('/').pop() || ''))
    );

    // 重複解消（song.mp3 → song(2).mp3 …）
    const m = origName.match(/^(.*?)(\.[^.]+)?$/);
    const base = (m?.[1] ?? origName) || origName;
    const ext  = m?.[2] ?? '';
    let finalName = origName;
    let idx = 1;
    while (existingNames.has(finalName)) {
      idx += 1; // 2 から始めたい
      finalName = `${base}(${idx})${ext}`;
    }

    // ④ 保存キー：audio/ + URLエンコード済みファイル名
    const key = 'audio/' + encodeURIComponent(finalName);

    // ⑤ 書き込み（バイナリ確定済みなので速い＆ハングしにくい）
    await store.set(key, bytes, {
      addRandomSuffix: false,
      contentType: mime,
      metadata: { title: finalName }, // 表示名
    });

    // ⑥ レスポンス
    return json({
      ok: true,
      id: key,
      title: finalName,
      size,
      date: new Date().toISOString(),
    });
  } catch (err) {
    // 失敗時にメッセージを返す（UIに表示される）
    return json({ ok:false, error:String(err?.message || err) }, 500);
  }
};