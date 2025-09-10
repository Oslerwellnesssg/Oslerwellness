import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const FLOW_SHARED_SECRET = process.env.FLOW_SHARED_SECRET as string;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Check secret
    const auth = event.headers['authorization'] || event.headers['Authorization'];
    if (!auth || !auth.toString().startsWith('Bearer ') || auth.toString().slice(7) !== FLOW_SHARED_SECRET) {
      return { statusCode: 401, body: 'Unauthorized' };
    }

    if (!event.body) return { statusCode: 400, body: 'Missing body' };

    let payload: any;
    try {
      payload = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, body: 'Invalid JSON' };
    }

    const sku = (payload.sku || '').trim().toUpperCase();
    const available = Number(payload.available);
    const loc_code = (payload.loc_code || '').trim().toUpperCase(); // Expect 'SV' or 'RH1'

    if (!sku || !Number.isFinite(available) || !loc_code) {
      return { statusCode: 400, body: 'Missing required fields: {sku, available, loc_code}' };
    }

    // Log raw
    await supabase.from('shopify_events').insert({
      raw: payload,
      sku,
      available,
      loc_code,
      status: 'received'
    });

    // Apply
    const { error } = await supabase.rpc('apply_shopify_flow', {
      p_sku: sku,
      p_loc_code: loc_code,
      p_available: available
    });

    if (error) {
      await supabase.from('shopify_events').insert({
        raw: payload,
        sku,
        available,
        loc_code,
        status: 'error',
        error: error.message
      });
      return { statusCode: 500, body: 'Supabase RPC error: ' + error.message };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e: any) {
    return { statusCode: 500, body: 'Server error: ' + (e?.message || e) };
  }
};
