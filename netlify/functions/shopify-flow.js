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
    const { sku, available, loc_code } = body;

    if (!sku || typeof available !== 'number' || !loc_code) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing sku/available/loc_code' }) };
    }

    // Call RPC apply_shopify_flow(sku, loc_code, available)
    await supabaseFetch('/rest/v1/rpc/apply_shopify_flow', {
      method: 'POST',
      body: JSON.stringify({ p_sku: sku, p_loc_code: loc_code, p_available: available })
    });

    // Also log to shopify_events for audit
    await supabaseFetch('/rest/v1/shopify_events', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ raw: { note: 'flow push' }, sku, available, loc_code, status: 'applied' })
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, sku, available, loc_code })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, errorType: 'Error', errorMessage: String(err.message || err) })
    };
  }
}