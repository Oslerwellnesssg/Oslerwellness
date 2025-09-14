const { createClient } = require('@supabase/supabase-js');

function getEnv(name, fallbacks = []) {
  if (process.env[name]) return process.env[name];
  for (const n of fallbacks) if (process.env[n]) return process.env[n];
  return undefined;
}

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_KEY', ['SUPABASE_SERVICE_ROLE', 'SUPABASE_SERVICE_KEY']);
const flowSecret  = getEnv('FLOW_SHARED_SECRET');

let supabase = null;
function getClient() {
  if (!supabaseUrl) throw new Error('supabaseUrl is required.');
  if (!supabaseKey) throw new Error('supabaseKey is required.');
  if (!supabase) supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  return supabase;
}

function json(body, status=200) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const incoming = event.headers['x-flow-secret'] || event.headers['X-Flow-Secret'];
  if (flowSecret && incoming !== flowSecret) return json({ ok:false, error:'unauthorized' }, 401);

  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch { return json({ ok:false, error:'invalid_json' }, 400); }

  const sku = (payload.sku || '').trim();
  const available = Number(payload.available);
  const loc_code = (payload.loc_code || '').trim(); // 'SV' or 'RH1'
  if (!sku || !Number.isFinite(available) || !loc_code) return json({ ok:false, error:'missing_fields', need:['sku','available','loc_code'] }, 400);

  const sb = getClient();

  let product_id = null;
  let status = 'received';
  let error = null;

  try {
    const { data: direct } = await sb.from('products').select('id').eq('sku', sku).limit(1).maybeSingle();
    if (direct && direct.id) product_id = direct.id;
    else {
      const { data: alias } = await sb.from('product_sku_aliases').select('product_id').eq('alias', sku).limit(1).maybeSingle();
      if (alias && alias.product_id) product_id = alias.product_id;
    }

    const loc = loc_code === 'SV' ? 'SV' : 'RH1';

    if (product_id) {
      await sb.rpc('ensure_stock_row', { p_product: product_id, p_loc: loc });

      const { data: curRow } = await sb.from('stock_levels').select('on_hand').eq('product_id', product_id).eq('location', loc).limit(1).maybeSingle();
      const cur = curRow && typeof curRow.on_hand === 'number' ? curRow.on_hand : 0;
      const delta = available - cur;

      await sb.from('stock_levels').update({ on_hand: available }).eq('product_id', product_id).eq('location', loc);

      if (delta !== 0) {
        if (delta > 0) {
          await sb.from('transactions').insert({ type:'adjust', product_id, to_loc:loc, qty_in:delta, qty_out:0, remarks:'Shopify sync' });
        } else {
          await sb.from('transactions').insert({ type:'adjust', product_id, from_loc:loc, qty_in:0, qty_out:Math.abs(delta), remarks:'Shopify sync' });
        }
      }
      status = 'applied';
    } else {
      status = 'no_match';
      error = 'No product matched by sku or alias';
    }
  } catch (e) {
    status = 'error';
    error = (e && e.message) || String(e);
  }

  try {
    await sb.from('shopify_events').insert({ raw: payload, sku, available, loc_code, product_id, status, error });
  } catch {}

  if (status === 'applied') return json({ ok:true });
  if (status === 'no_match') return json({ ok:false, status, message:'SKU not recognised in products or aliases' });
  return json({ ok:false, status, error }, 500);
};
