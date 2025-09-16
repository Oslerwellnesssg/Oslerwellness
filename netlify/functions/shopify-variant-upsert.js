
/**
 * Netlify Function: shopify-variant-upsert
 * Purpose: When a Shopify variant is added/updated, upsert it into Supabase `products`
 *          and ensure stock rows exist for both locations (SV, RH1).
 *
 * Env Vars needed on Netlify:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - FLOW_SHARED_SECRET      (same value you store as a secret in Shopify Flow)
 *
 * HTTP: POST /.netlify/functions/shopify-variant-upsert
 * Headers:
 *   Authorization: Bearer <FLOW_SHARED_SECRET>
 * Body (JSON example from Shopify Flow):
 *   {
 *     "title": "...",
 *     "variantTitle": "...",
 *     "sku": "...",
 *     "barcode": "...",
 *     "price": 72.00
 *   }
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FLOW_SHARED_SECRET = process.env.FLOW_SHARED_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const auth = event.headers['authorization'] || event.headers['Authorization'];
    if (!auth || !auth.startsWith('Bearer ') || auth.slice(7) !== FLOW_SHARED_SECRET) {
      return { statusCode: 401, body: 'Unauthorized' };
    }

    const raw = event.body ? JSON.parse(event.body) : {};
    const title = (raw.title || '').trim();
    const variantTitle = (raw.variantTitle || '').trim();
    const sku = (raw.sku || '').trim();
    const barcode = (raw.barcode || '').trim();
    const price = raw.price != null ? Number(raw.price) : null;

    if (!sku && !title) {
      return { statusCode: 400, body: 'Missing sku/title' };
    }

    // Compose a stable product name (Title - VariantTitle if provided)
    let name = title;
    if (variantTitle && !title.includes(variantTitle)) {
      name = `${title} - ${variantTitle}`;
    }
    if (!name) name = sku || 'Unnamed Variant';

    // Try to find existing product by SKU first
    let prodId = null;
    const prodBySku = await supabase
      .from('products')
      .select('id')
      .eq('sku', sku)
      .maybeSingle();

    if (prodBySku && prodBySku.data && prodBySku.data.id) {
      prodId = prodBySku.data.id;
    } else {
      // Try by name
      const prodByName = await supabase
        .from('products')
        .select('id')
        .eq('name', name)
        .maybeSingle();
      if (prodByName && prodByName.data && prodByName.data.id) {
        prodId = prodByName.data.id;
      }
    }

    if (!prodId) {
      // Create a new UUID client-side in case the table expects explicit id sometimes
      // but Supabase default gen_random_uuid() is usually present. We'll let DB create it.
      const insertFields = { name };
      if (sku) insertFields.sku = sku;
      if (barcode) insertFields.barcode = barcode;
      if (price != null && !Number.isNaN(price)) insertFields.sell_price = price;

      const ins = await supabase.from('products').insert(insertFields).select('id').single();
      if (ins.error) {
        return { statusCode: 500, body: `Insert error: ${ins.error.message}` };
      }
      prodId = ins.data.id;
    } else {
      // Update existing product with any new info (non-destructive)
      const updFields = { name };
      if (sku) updFields.sku = sku;
      if (barcode) updFields.barcode = barcode;
      if (price != null && !Number.isNaN(price)) updFields.sell_price = price;

      const upd = await supabase.from('products').update(updFields).eq('id', prodId);
      if (upd.error) {
        return { statusCode: 500, body: `Update error: ${upd.error.message}` };
      }
    }

    // Ensure both locations exist so the product is visible in your app immediately
    const ensureSV = await supabase.rpc('ensure_stock_row', { p_product: prodId, p_loc: 'SV' });
    if (ensureSV.error) {
      return { statusCode: 500, body: `ensure_stock_row SV: ${ensureSV.error.message}` };
    }
    const ensureRH1 = await supabase.rpc('ensure_stock_row', { p_product: prodId, p_loc: 'RH1' });
    if (ensureRH1.error) {
      return { statusCode: 500, body: `ensure_stock_row RH1: ${ensureRH1.error.message}` };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, product_id: prodId })
    };
  } catch (e) {
    return { statusCode: 500, body: `Server error: ${e && e.message ? e.message : String(e)}` };
  }
};
