const fetch = require("node-fetch");

/**
 * Receives Shopify Flow POST with body:
 * { sku: "CK13", available: 7, loc_code: "SV" }
 * Requires header X-Flow-Secret to match env FLOW_SHARED_SECRET.
 * Calls Supabase RPC: apply_shopify_flow(sku, loc_code, available)
 */
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const secret = process.env.FLOW_SHARED_SECRET;
  if (!secret) {
    return { statusCode: 500, body: "Missing env FLOW_SHARED_SECRET" };
  }
  if (event.headers["x-flow-secret"] !== secret) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { sku, available, loc_code } = payload || {};
  if (!sku || typeof available !== "number" || !loc_code) {
    return {
      statusCode: 400,
      body: JSON.stringify({ ok: false, error: "Missing sku/available/loc_code" }),
    };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return { statusCode: 500, body: "Missing Supabase envs" };
  }

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/apply_shopify_flow`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_ROLE,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE}`
      },
      body: JSON.stringify({ p_sku: sku, p_loc_code: loc_code, p_available: available })
    });

    const text = await resp.text();
    if (!resp.ok) {
      return { statusCode: 502, body: `Supabase error: ${text}` };
    }
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true, sku, loc: loc_code, available })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error: String(err) }) };
  }
};