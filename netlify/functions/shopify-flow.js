
// netlify/functions/shopify-flow.js (compat header)
// Accepts X-Flow-Secret: OslerHealth2727 OR Authorization: Bearer OslerHealth2727
const { createClient } = require('@supabase/supabase-js');

function getSharedSecretFromHeaders(headers){
  const xf = headers['x-flow-secret'] || headers['X-Flow-Secret'];
  if (xf && xf.trim()) return xf.trim();
  const auth = headers['authorization'] || headers['Authorization'];
  if (!auth) return '';
  // Accept "Bearer SECRET" or just "SECRET"
  const val = auth.trim();
  return val.startsWith('Bearer ') ? val.slice(7).trim() : val;
}

function env(name, fallbacks = []){ if (process.env[name]) return process.env[name]; for (const n of fallbacks) if (process.env[n]) return process.env[n]; return null; }
const SUPABASE_URL = env('SUPABASE_URL');
const SUPABASE_KEY = env('SUPABASE_KEY', ['SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SERVICE_ROLE','SUPABASE_SERVICE_KEY']);
const SHARED = env('FLOW_SHARED_SECRET');
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession:false } });
function mapLoc(body){ const raw = (body.loc_code || body.location || body.loc || '').toString().trim(); if (!raw) return null; const s = raw.toUpperCase(); if (s === 'SV' || s.includes('STAR VISTA')) return 'SV'; if (s === 'RH1' || s.includes('RAFFLES')) return 'RH1'; return null; }
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    if (!SUPABASE_URL || !SUPABASE_KEY) return { statusCode: 500, body: 'Missing env SUPABASE_URL or SUPABASE_KEY' };
    const secret = getSharedSecretFromHeaders(event.headers);
    if (!secret || (SHARED && secret !== SHARED)) return { statusCode: 401, body: 'Unauthorized' };
    const payload = event.isBase64Encoded ? JSON.parse(Buffer.from(event.body||'', 'base64').toString('utf8')||'{}') : JSON.parse(event.body||'{}');
    const sku = (payload.sku||'').toString().trim();
    const available = Number(payload.available);
    const loc = mapLoc(payload);
    try { await sb.from('shopify_events').insert({ raw: payload, sku: sku||null, available: isFinite(available)?available:null, loc_code: loc||null, status: 'received' }); } catch {};
    if (!sku || !isFinite(available) || loc==null) return { statusCode: 400, body: 'Missing sku/available/loc_code' };
    let productId = null;
    const { data: p1 } = await sb.from('products').select('id').ilike('sku', sku).limit(1).maybeSingle(); if (p1&&p1.id) productId = p1.id;
    if (!productId) { const { data: a1 } = await sb.from('product_sku_aliases').select('product_id').ilike('alias', sku).limit(1).maybeSingle(); if (a1&&a1.product_id) productId=a1.product_id; }
    if (!productId) { await sb.from('shopify_events').insert({ raw: payload, sku, available, loc_code: loc, status:'error', error:'SKU not found' }); return { statusCode:200, body: JSON.stringify({ ok:true, skipped:true, reason:'sku_not_found' }) }; }
    await sb.rpc('ensure_stock_row', { p_product: productId, p_loc: 'SV' });
    await sb.rpc('ensure_stock_row', { p_product: productId, p_loc: 'RH1' });
    const { error: e2 } = await sb.from('stock_levels').update({ on_hand: available, updated_at: new Date().toISOString() }).eq('product_id', productId).eq('location', loc);
    if (e2) { await sb.from('shopify_events').insert({ raw: payload, sku, available, loc_code: loc, product_id: productId, status:'error', error:e2.message }); return { statusCode:500, body: 'DB update failed: '+e2.message }; }
    await sb.from('shopify_events').insert({ raw: payload, sku, available, loc_code: loc, product_id: productId, status:'applied' });
    return { statusCode: 200, body: JSON.stringify({ ok:true, product_id: productId, loc, available }) };
  } catch (e) { return { statusCode: 500, body: String(e?.message||e) }; }
};
