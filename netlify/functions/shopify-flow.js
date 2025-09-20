const ok = (b) => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const err = (e) => ({ statusCode: 200, headers: { 'content-type': 'text/plain; charset=utf-8' }, body: JSON.stringify(e) });

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    const shared = event.headers['x-flow-secret'] || event.headers['X-Flow-Secret'];
    if (!process.env.FLOW_SHARED_SECRET || shared !== process.env.FLOW_SHARED_SECRET) {
      return err({ ok:false, error:'bad_secret' });
    }
    const payload = JSON.parse(event.body || '{}');
    const { sku, loc_code, available } = payload;
    if (!sku || !loc_code || typeof available !== 'number') {
      return err({ ok:false, error:'bad_payload', payload });
    }
    const url = `${process.env.SUPABASE_URL}/rest/v1/rpc/apply_shopify_flow`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_sku: sku, p_loc_code: loc_code, p_available: available })
    });
    const text = await res.text();
    if (!res.ok) return err({ ok:false, error:'supabase_error', status: res.status, text });
    return ok({ ok:true, sku, loc: loc_code, available });
  } catch (e) {
    return err({ ok:false, error: e.message, stack: String(e.stack||'') });
  }
};