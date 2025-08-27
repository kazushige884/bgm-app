// functions/upload.js
import { getStore } from '@netlify/blobs';
import { preflight, json, STORE_NAME } from './_lib.js';

export const config = { bodyParser: false };

export default async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || !file.name) {
      return json({ ok: false, error: 'no-file' }, 400);
    }

    // オリジナル名をエンコードして保存
    const origName = file.name;
    let key = 'audio/' + encodeURIComponent(origName);

    const store = getStore({ name: STORE_NAME });

    // 重複チェック
    let finalKey = key;
    let count = 1;
    while (true) {
      const exists = await store.get(finalKey).catch(() => null);
      if (!exists) break;
      // song.mp3 → song(2).mp3
      const m = origName.match(/^(.*?)(\.[^.]+)?$/);
      const base = m[1];
      const ext = m[2] || '';
      const newName = `${base}(${++count})${ext}`;
      finalKey = 'audio/' + encodeURIComponent(newName);
    }

    // 保存
    await store.set(finalKey, file.stream(), {
      addRandomSuffix: false,
      metadata: { title: origName },
    });

    return json({
      ok: true,
      id: finalKey,
      title: origName,
      size: file.size,
      date: new Date().toISOString(),
    });

  } catch (err) {
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
};