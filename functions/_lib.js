// functions/_lib.js
export const STORE_NAME = 'bgm-store-v2'; // ← 全ファイルでこの定数を使います（必ず同じに）

export const cors = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
});

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  });

export const preflight = (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: cors() });
  }
  return null;
};

export async function readMultipartFile(request, field = 'file') {
  const ct = request.headers.get('content-type') || '';
  if (!ct.startsWith('multipart/form-data')) return null;
  const form = await request.formData();
  const file = form.get(field);
  if (!file || typeof file.arrayBuffer !== 'function') return null;
  return file;
}

export function ok() { return new Response('ok', { status: 200 }); }