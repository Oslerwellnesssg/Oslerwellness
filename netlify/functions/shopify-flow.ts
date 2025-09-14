import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession:false } });
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const auth = event.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ') || auth.slice(7) !== process.env.FLOW_SHARED_SECRET) return { statusCode: 401, body: 'Unauthorized' };
  let body: any = {}; try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'Invalid JSON' }; }
  const sku = (body.sku||'').toString().trim().toUpperCase();
  const available = Number(body.available);
  const loc = (body.loc_code||'').toString().trim().toUpperCase();
  if (!sku || !Number.isFinite(available) || !loc) return { statusCode: 400, body: 'Missing fields' };
  await supabase.from('shopify_events').insert({ raw: body, sku, available, loc_code: loc, status: 'received' });
  const { error } = await supabase.rpc('apply_shopify_flow', { p_sku: sku, p_loc_code: loc, p_available: available });
  if (error) { await supabase.from('shopify_events').insert({ raw: body, sku, available, loc_code: loc, status:'error', error: error.message }); return { statusCode: 500, body: 'RPC error' }; }
  return { statusCode: 200, body: JSON.stringify({ ok:true }) };
};