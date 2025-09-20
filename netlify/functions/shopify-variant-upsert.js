const fetch = require("node-fetch");

/**
 * Receives from Shopify Flow (Variant Added) with body:
 * { title, sku, barcode, price }
 * Upserts product in Supabase and ensures stock rows exist.
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

  const { title, sku, barcode, price } = payload || {};
  if (!sku) {
    return { statusCode: 400, body: "Missing sku" };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return { statusCode: 500, body: "Missing Supabase envs" };
  }

  try {
    // Upsert product by SKU
    const upsertResp = await fetch(`${SUPABASE_URL}/rest/v1/products?on_conflict=sku`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
        "apikey": SUPABASE_SERVICE_ROLE,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE}`
      },
      body: JSON.stringify([{
        name: title || sku,
        sku,
        barcode: barcode || null,
        sell_price: typeof price === "number" ? price : null
      }])
    });
    const upsertText = await upsertResp.text();
    if (!upsertResp.ok) {
      return { statusCode: 502, body: `Supabase upsert error: ${upsertText}` };
    }

    // Ensure both SV & RH1 stock rows exist via RPC ensure_stock_row
    // First fetch product id
    const prodResp = await fetch(${SUPABASE_URL}/rest/v1/products?sku=eq." + encodeURIComponent(sku) + "&select=id", {
      headers: { "apikey": SUPABASE_SERVICE_ROLE, "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE}` }
    });
    const prods = await prodResp.json();
    const id = prods && prods[0] && prods[0].id;
    if (id) {
      const ensure = async (loc) => fetch(`${SUPABASE_URL}/rest/v1/rpc/ensure_stock_row`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_SERVICE_ROLE,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE}`
        },
        body: JSON.stringify({ p_product: id, p_loc: loc })
      });
      await ensure("SV"); await ensure("RH1");
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, sku }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error: String(err) }) };
  }
};