// 最小のCORS/プリフライト/JSONユーティリティ（認証なし）
export function cors(headers = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...headers,
  };
}

export function preflight(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: cors({ "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS" })
    });
  }
  return null;
}

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: cors({ "Content-Type": "application/json", ...extra })
  });
}