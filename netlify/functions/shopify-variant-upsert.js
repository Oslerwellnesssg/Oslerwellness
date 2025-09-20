const ok = (b) => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const err = (e) => ({ statusCode: 200, headers: { 'content-type': 'text/plain; charset=utf-8' }, body: JSON.stringify(e) });

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    const shared = event.headers['x-flow-secret'] || event.headers['X-Flow-Secret'];
    if (!process.env.FLOW_SHARED_SECRET || shared !== process.env.FLOW_SHARED_SECRET) {
      return err({ ok:false, error:'bad_secret' });
    }
    const { title, sku, barcode, price } = JSON.parse(event.body || '{}');
    if (!sku) return err({ ok:false, error:'missing_sku' });
    const url = `${process.env.SUPABASE_URL}/rest/v1/rpc/set_stock_by_sku`;
    const body = {
      p_password: process.env.STOCK_SET_PASSWORD || '#2734',
      p_sku: sku,
      p_sv: 0,
      p_rh1: 0,
      p_new_name: title || sku,
      p_new_barcode: barcode || null,
      p_new_price: typeof price === 'number' ? price : null
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    if (!res.ok) return err({ ok:false, error:'supabase_error', status: res.status, text });
    return ok({ ok:true, sku, upserted:true });
  } catch (e) {
    return err({ ok:false, error:e.message, stack:String(e.stack||'') });
  }
};