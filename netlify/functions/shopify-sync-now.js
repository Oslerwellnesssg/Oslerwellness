/**
 * Flow-only friendly "Sync Now". We DO NOT call Shopify Admin.
 * Instead, we just answer OK so the UI can refresh from Supabase.
 * If you want to add extra logic later (e.g., reconcile function), do it here.
 */
exports.handler = async () => ({
  statusCode: 200,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ok: true, mode: "flow-only", ts: new Date().toISOString() })
});