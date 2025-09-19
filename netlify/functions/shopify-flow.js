// netlify/functions/shopify-flow.js
// Uses Node 18+'s global fetch (no node-fetch).
// Accepts POSTs from Shopify Flow:
//   headers: X-Flow-Secret: <FLOW_SHARED_SECRET>
//   body: { "sku": "CK13", "available": 7, "loc_code": "SV" }
//
// Writes into Supabase by calling RPC public.apply_shopify_flow(p_sku, p_loc_code, p_available)

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE", "FLOW_SHARED_SECRET"];
function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function json(body, status = 200, headers = {}) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}

function text(body, status = 200, headers = {}) {
  return {
    statusCode: status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      // Simple CORS preflight (allow Shopify Flow to POST)
      return {
        statusCode: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, X-Flow-Secret",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
        body: "",
      };
    }

    if (event.httpMethod !== "POST") {
      return text("Method Not Allowed", 405);
    }

    // Validate required envs up front for clear errors
    for (const k of REQUIRED_ENV) env(k);

    const FLOW_SHARED_SECRET = env("FLOW_SHARED_SECRET");
    const SUPABASE_URL = env("SUPABASE_URL").replace(/\/+$/, "");
    const SUPABASE_SERVICE_ROLE = env("SUPABASE_SERVICE_ROLE");
    const DEFAULT_FLOW_LOCATION = process.env.DEFAULT_FLOW_LOCATION || "SV";

    const provided = event.headers["x-flow-secret"] || event.headers["X-Flow-Secret"];
    if (!provided || provided !== FLOW_SHARED_SECRET) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }

    const sku = (payload.sku || "").toString().trim();
    const available = Number(payload.available);
    const loc = (payload.loc_code || DEFAULT_FLOW_LOCATION).toString().toUpperCase();

    if (!sku) return json({ ok: false, error: "missing_sku" }, 400);
    if (!Number.isFinite(available)) return json({ ok: false, error: "missing_available" }, 400);
    if (!["SV", "RH1"].includes(loc)) return json({ ok: false, error: "bad_location" }, 400);

    // Call Supabase RPC: public.apply_shopify_flow(p_sku text, p_loc_code text, p_available int)
    const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/apply_shopify_flow`;
    const rpcRes = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        p_sku: sku,
        p_loc_code: loc,
        p_available: available,
      }),
    });

    if (!rpcRes.ok) {
      const msg = await rpcRes.text();
      return json({ ok: false, error: "rpc_failed", detail: msg }, 502);
    }

    // Optional: look up product_id by SKU so response mirrors previous behavior
    let product_id = null;
    try {
      const selUrl = `${SUPABASE_URL}/rest/v1/products?sku=eq.${encodeURIComponent(sku)}&select=id`;
      const selRes = await fetch(selUrl, {
        headers: {
          "apikey": SUPABASE_SERVICE_ROLE,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE}`,
          "Accept": "application/json",
        },
      });
      if (selRes.ok) {
        const rows = await selRes.json();
        if (Array.isArray(rows) && rows.length > 0) product_id = rows[0].id || null;
      }
    } catch (_) {
      // ignore lookup failures
    }

    return text({ ok: true, product_id, loc, available });
  } catch (err) {
    return json(
      { ok: false, errorType: err.name || "Error", errorMessage: err.message || String(err) },
      500
    );
  }
};
