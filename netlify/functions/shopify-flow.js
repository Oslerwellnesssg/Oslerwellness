// Flow → Supabase bridge (no Shopify Admin API required)
const fetch = require("node-fetch");

const REQUIRED_SECRET = process.env.FLOW_SHARED_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // Verify Flow shared secret
    const hSecret = event.headers["x-flow-secret"] || event.headers["X-Flow-Secret"];
    if (!REQUIRED_SECRET || hSecret !== REQUIRED_SECRET) {
      return { statusCode: 401, body: "Unauthorized: bad X-Flow-Secret" };
    }

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return { statusCode: 500, body: "Server not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE)" };
    }

    const payload = JSON.parse(event.body || "{}");
    const sku = (payload.sku || "").trim();
    const available = Number(payload.available);
    const loc_code = (payload.loc_code || "").trim();

    if (!sku || !Number.isFinite(available) || !loc_code) {
      return { statusCode: 400, body: "Bad request: require sku, available, loc_code" };
    }

    // Call the Postgres function apply_shopify_flow(p_sku, p_loc_code, p_available)
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/apply_shopify_flow`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`
      },
      body: JSON.stringify({
        p_sku: sku,
        p_loc_code: loc_code,
        p_available: available
      })
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      return { statusCode: 502, body: `Supabase error: ${errTxt}` };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, applied: { sku, available, loc: loc_code } })
    };
  } catch (e) {
    return { statusCode: 500, body: `Server error: ${e.message}` };
  }
};
