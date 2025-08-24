// functions/whoami.js
export default async () =>
  new Response(
    JSON.stringify({
      siteId: process.env.NETLIFY_SITE_ID || null,
      ctx: 'functions',
    }),
    { headers: { 'content-type': 'application/json' } }
  );