
// netlify/functions/shopify-variant-upsert.js
// Creates/updates a product row when a new Shopify product variant is added.
//
// Trigger: Shopify Flow → "Product variant added"
// Header:  X-Flow-Secret: OslerHealth2727
// Body (use Flow variable picker):
// {
//   "sku": "{{ productVariant.sku }}",
//   "title": "{{ product.title }}",
//   "barcode": "{{ productVariant.barcode }}",
//   "price": {{ productVariant.price }}
// }
//
const { createClient } = require('@supabase/supabase-js');

function env(name, fallbacks = []){
  if (process.env[name]) return process.env[name];
  for (const n of fallbacks) if (process.env[n]) return process.env[n];
  return null;
}

const SUPABASE_URL = env('SUPABASE_URL');
const SUPABASE_KEY = env('SUPABASE_KEY', ['SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SERVICE_ROLE','SUPABASE_SERVICE_KEY']);
const SHARED = env('FLOW_SHARED_SECRET');

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession:false } });

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return { statusCode: 500, body: 'Missing env SUPABASE_URL or SUPABASE_KEY' };
    }

    const secret = (event.headers['x-flow-secret'] || event.headers['X-Flow-Secret'] || '').trim();
    if (!secret || (SHARED && secret !== SHARED)) {
      return { statusCode: 401, body: 'Unauthorized (bad X-Flow-Secret)' };
    }

    const body = event.isBase64Encoded
      ? JSON.parse(Buffer.from(event.body || '', 'base64').toString('utf8') || '{}')
      : JSON.parse(event.body || '{}');

    const sku = (body.sku || '').toString().trim();
    const title = (body.title || '').toString().trim() || sku;
    const barcode = (body.barcode || '').toString().trim() || null;
    const price = Number(body.price);

    if (!sku) return { statusCode: 400, body: 'Missing sku' };

    const up = {
      name: title,
      sku,
      barcode,
      sell_price: isFinite(price) ? price : undefined
    };

    const { data, error } = await sb
      .from('products')
      .upsert(up, { onConflict: 'sku' })
      .select('id')
      .limit(1);

    if (error) return { statusCode: 500, body: 'Upsert failed: ' + error.message };

    const productId = data && data[0] && data[0].id;

    // Ensure both stock rows exist so it appears in the app immediately
    await sb.rpc('ensure_stock_row', { p_product: productId, p_loc: 'SV' });
    await sb.rpc('ensure_stock_row', { p_product: productId, p_loc: 'RH1' });

    return { statusCode: 200, body: JSON.stringify({ ok:true, product_id: productId }) };
  } catch (e) {
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
