// "Safety" refresh endpoint: no Shopify Admin API required.
// It forces a noop insert into shopify_events so your Supabase
// real-time and the Plato page know to refresh.
import { env, supabaseFetch } from './_common.js';

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }
    await supabaseFetch('/rest/v1/shopify_events', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ raw: { note: 'manual refresh' }, status: 'refresh' })
    });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, mode: 'refresh-only' }) };
  } catch (err) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: String(err.message || err) }) };
  }
}