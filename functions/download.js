import { getStore } from '@netlify/blobs';
import { preflight, json, cors } from './_lib.js';

export default async (request) => {
  const pf = preflight(request); if (pf) return pf;

  const u = new URL(request.url);
  const id = u.searchParams.get('id');
  if (!id || !id.startsWith('audio/')) return json({ error: 'bad id' }, 400);

  const store = getStore({ name: 'bgm-store' });

  // いろんな返り値形に耐える実装（ライブラリ差異吸収）
  let data = await store.get(id);      // 返り値の型が環境で異なることがある
  let contentType = 'audio/mpeg';

  if (!data) return json({ error: 'not found' }, 404);

  if (data?.body) {                    // { body, contentType } 形式
    contentType = data.contentType || contentType;
    data = data.body;
  } else if (data?.arrayBuffer) {      // Blob/Response 風
    data = await data.arrayBuffer();
  } else if (data instanceof ArrayBuffer) {
    // そのままOK
  } else if (data instanceof Uint8Array) {
    data = data.buffer;
  }

  return new Response(data, {
    status: 200,
    headers: {
      ...cors(),
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600'
    }
  });
};