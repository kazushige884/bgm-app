// functions/download.js
import { getStore } from '@netlify/blobs';
import { preflight } from './_lib.js';

export default async (request) => {
  // CORS・OPTIONS の事前応答（お使いの _lib.js に合わせています）
  const pf = preflight(request);
  if (pf) return pf;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('method not allowed', { status: 405 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return new Response('id required', { status: 400 });

    const store = getStore({ name: 'bgm-store' });

    // --- 第一候補：署名付きURLへリダイレクト（Range/Content-Type はストレージに委譲）---
    try {
      // API 互換のため存在チェック
      if (typeof store.getSignedUrl === 'function') {
        // 60秒だけ有効な一時URL
        const signed = await store.getSignedUrl({ key: id, expires: 60 });
        if (signed) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: signed,
              // ブラウザにキャッシュさせない（常に最新を取る）
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });
        }
      }
    } catch (_) {
      // 署名URLが使えない環境は下のフォールバックへ
    }

    // --- フォールバック：Blobs からストリーム取得して返す（Range なし）---
    const blob = await store.get(id, { type: 'stream' });
    if (!blob || !blob.body) return new Response('not found', { status: 404 });

    const headers = {
      'Content-Type': blob.contentType || 'audio/mpeg',
      ...(blob.size ? { 'Content-Length': String(blob.size) } : {}),
      // Range は 200 配信時も bytes を明示（ブラウザの挙動安定化）
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    };

    if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
    return new Response(blob.body, { status: 200, headers });
  } catch (err) {
    // 500 の原因を前面に出す
    return new Response('download error: ' + String(err?.message || err), { status: 500 });
  }
};