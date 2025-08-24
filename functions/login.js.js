import { preflight, setCookie, cors, json } from './_lib.js';

export default async (request) => {
  const pf = preflight(request); if(pf) return pf;
  if(request.method !== 'POST') return json({error:'method'}, 405);

  const { id } = await request.json().catch(()=>({}));
  if(String(id) !== 'Mk1106mk') return json({ ok:false, msg:'invalid id' }, 401);

  const cookie = setCookie('Mk1106mk');
  return new Response(JSON.stringify({ ok:true }), { headers: { ...cors({'Content-Type':'application/json'}), 'Set-Cookie': cookie } });
};