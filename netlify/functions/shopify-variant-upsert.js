import { env, supabaseFetch } from './_common.js';

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const secret = event.headers['x-flow-secret'] || event.headers['X-Flow-Secret'];
    if (secret !== env('FLOW_SHARED_SECRET')) {
      return { statusCode: 401, body: 'Bad secret' };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const { title, sku, barcode, price } = body;

    if (!sku) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing sku' }) };
    }

    // Upsert into products by SKU
    const product = {
      name: title || sku,
      sku,
      barcode: barcode || null,
      sell_price: typeof price === 'number' ? price : null,
      updated_at: new Date().toISOString()
    };

    // Upsert row
    await supabaseFetch('/rest/v1/products?on_conflict=sku', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([product])
    });

    // Ensure stock rows exist
    const q = new URLSearchParams({ sku: `eq.${sku}` }).toString();
    const products = await supabaseFetch(`/rest/v1/products?${q}&select=id`);
    const id = products && products[0] && products[0].id;

    if (id) {
      await supabaseFetch('/rest/v1/rpc/ensure_stock_row', { method: 'POST', body: JSON.stringify({ p_product: id, p_loc: 'SV' }) });
      await supabaseFetch('/rest/v1/rpc/ensure_stock_row', { method: 'POST', body: JSON.stringify({ p_product: id, p_loc: 'RH1' }) });
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, sku }) };
  } catch (err) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: String(err.message || err) }) };
  }
}