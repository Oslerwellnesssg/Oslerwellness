
// netlify/functions/shopify-sync-now.js
// Purpose: One-click reconciliation — Pull latest quantities from Shopify Admin API
// and overwrite Supabase stock_levels for SV/RH1.
// Env needed: SHOPIFY_STORE, SHOPIFY_ADMIN_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY),
//             FLOW_SHARED_SECRET (we reuse it for auth from the browser/button).

const { createClient } = require('@supabase/supabase-js');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

function env(name, fallbacks=[]) {
  if (process.env[name]) return process.env[name];
  for (const n of fallbacks) if (process.env[n]) return process.env[n];
  throw new Error(`Missing env ${name}`);
}

const SHOP    = env('SHOPIFY_STORE'); // e.g. my-shop.myshopify.com
const TOKEN   = env('SHOPIFY_ADMIN_TOKEN');
const SB_URL  = env('SUPABASE_URL');
const SB_KEY  = env('SUPABASE_KEY', ['SUPABASE_SERVICE_ROLE', 'SUPABASE_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']);
const SECRET  = env('FLOW_SHARED_SECRET');

const LOC_MAP = {
  'Star Vista Clinic': 'SV',
  'Raffles Clinic'   : 'RH1',
  'SV'               : 'SV',
  'RH1'              : 'RH1'
};

const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession:false } });

async function fetchAllVariants() {
  const url = `https://${SHOP}/admin/api/2024-07/graphql.json`;
  const q = `
    query ($cursor: String) {
      products(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          title
          variants(first: 100) {
            nodes {
              sku
              barcode
              price
              inventoryItem {
                inventoryLevels(first: 50) {
                  nodes { available location { name } }
                }
              }
            }
          }
        }
      }
    }`;
  let cursor = null, out = [];
  for (let guard=0; guard<50; guard++) {
    const res = await fetch(url, {
      method:'POST',
      headers: { 'Content-Type':'application/json', 'X-Shopify-Access-Token': TOKEN },
      body: JSON.stringify({ query: q, variables: { cursor } })
    });
    if (!res.ok) throw new Error(`Shopify GQL ${res.status}`);
    const json = await res.json();
    const products = json?.data?.products?.nodes || [];
    for (const p of products) {
      for (const v of (p.variants?.nodes || [])) {
        const sku = (v.sku || '').trim();
        if (!sku) continue;
        const levels = v.inventoryItem?.inventoryLevels?.nodes || [];
        out.push({ sku, title: p.title || '', price: v.price, barcode: v.barcode, levels });
      }
    }
    const pi = json?.data?.products?.pageInfo;
    if (!pi?.hasNextPage) break;
    cursor = pi.endCursor;
  }
  return out;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    const auth = event.headers.authorization || event.headers.Authorization || '';
    if (auth !== `Bearer ${SECRET}`) return { statusCode: 401, body: 'Unauthorized' };

    const variants = await fetchAllVariants();
    let applied = 0, skipped = 0;

    for (const v of variants) {
      let sv = null, rh1 = null;
      for (const lvl of v.levels) {
        const name = (lvl.location?.name || '').trim();
        const code = LOC_MAP[name] || name;
        if (code === 'SV')  sv  = Number(lvl.available ?? 0);
        if (code === 'RH1') rh1 = Number(lvl.available ?? 0);
      }
      // Update SV and RH1 if present
      for (const pair of [['SV', sv], ['RH1', rh1]]) {
        const [loc, qty] = pair;
        if (qty == null) continue;
        // find product
        const { data: prod, error: perr } = await sb.from('products').select('id').eq('sku', v.sku).limit(1).maybeSingle();
        if (perr || !prod) { skipped++; continue; }
        // ensure row then update
        const { error: e1 } = await sb.rpc('ensure_stock_row', { p_product: prod.id, p_loc: loc });
        if (e1) throw new Error(`ensure_stock_row ${v.sku}/${loc}: ${e1.message}`);
        const { error: e2 } = await sb.from('stock_levels')
          .update({ on_hand: qty, updated_at: new Date().toISOString() })
          .eq('product_id', prod.id).eq('location', loc);
        if (e2) throw new Error(`update ${v.sku}/${loc}: ${e2.message}`);
        applied++;
      }
    }
    return { statusCode: 200, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ok:true, applied, skipped }) };
  } catch (e) {
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
