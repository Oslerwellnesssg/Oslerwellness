// netlify/functions/shopify-variant-upsert.js
// Upserts a product into Supabase when a Shopify product variant is created.
// Expects JSON body: { title, sku, barcode, price }
export default async (req, context) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    const body = await req.json();
    const title = (body.title || '').toString();
    const sku = (body.sku || '').toString();
    const barcode = body.barcode ? body.barcode.toString() : null;
    const price = typeof body.price === 'number' ? body.price : (Number(body.price) || 0);

    if (!sku) {
      return Response.json({ ok:false, error:'missing_sku' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      return Response.json({ ok:false, error:'missing_supabase_env' }, { status: 500 });
    }

    // Call the helper RPC to ensure product exists and stock rows exist.
    // We set both SV and RH1 to current values (0) — actual stock will be set by Flow pushes.
    const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/set_stock_by_sku`;
    const payload = {
      p_password: '#2734',
      p_sku: sku,
      p_sv: 0,
      p_rh1: 0,
      p_new_name: title || sku,
      p_new_barcode: barcode,
      p_new_price: price
    };

    const resp = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const text = await resp.text();
      return Response.json({ ok:false, step:'rpc', status:resp.status, body:text }, { status: 500 });
    }

    return Response.json({ ok:true, upserted:true, sku, title, barcode, price });
  } catch (err) {
    return Response.json({ ok:false, error:err.message || String(err) }, { status: 500 });
  }
};