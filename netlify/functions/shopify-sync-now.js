// netlify/functions/shopify-sync-now.js
// "Safety" sync button for the Plato inventory page.
// Because inventory is source-of-truth from Shopify Flow → Supabase, this function does not
// pull from Shopify. It simply returns OK (and could run lightweight housekeeping).
export default async (req, context) => {
  try {
    if (req.method !== 'POST') {
      // Allow GET as a simple health check
      return Response.json({ ok:true, noop:true });
    }
    // Optional: trigger a lightweight reconciliation in Supabase if you want
    // to ensure stock rows exist (safe, idempotent). Commented out by default.
    /*
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/reconcile_stock_levels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`
        }
      });
    }
    */
    return Response.json({ ok:true, message:'Sync button acknowledged. Live inventory flows via Shopify Flow → Supabase.' });
  } catch (err) {
    return Response.json({ ok:false, error: err.message || String(err) }, { status: 500 });
  }
};