// Upsert product from Flow (title, sku, barcode, price)
const fetch = require("node-fetch");
const REQUIRED_SECRET = process.env.FLOW_SHARED_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  try {
    const hSecret = event.headers["x-flow-secret"] || event.headers["X-Flow-Secret"];
    if (!REQUIRED_SECRET || hSecret !== REQUIRED_SECRET) {
      return { statusCode: 401, body: "Unauthorized: bad X-Flow-Secret" };
    }
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return { statusCode: 500, body: "Server not configured" };
    }
    const p = JSON.parse(event.body || "{}");
    const title = (p.title || "").trim();
    const sku = (p.sku || "").trim();
    const barcode = (p.barcode || "").trim();
    const price = isFinite(p.price) ? Number(p.price) : null;

    if (!sku) return { statusCode: 400, body: "Missing sku" };

    // Upsert by SKU
    const upsert = await fetch(`${SUPABASE_URL}/rest/v1/products?on_conflict=sku`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`
      },
      body: JSON.stringify([{
        name: title || sku,
        sku,
        barcode: barcode || null,
        sell_price: price ?? 0
      }])
    });
    if (!upsert.ok) {
      return { statusCode: 502, body: await upsert.text() };
    }

    // Ensure stock rows exist
    const ensure = async (loc) => fetch(`${SUPABASE_URL}/rest/v1/rpc/ensure_stock_row`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`
      },
      body: JSON.stringify({
        p_product: `select id from public.products where sku='${sku}' limit 1`,
        p_loc: loc
      })
    });

    // Skip ensure via RPC hack above; optionally client can create on first movement.

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, upserted: { sku, title, barcode, price } })
    };
  } catch (e) {
    return { statusCode: 500, body: `Server error: ${e.message}` };
  }
};
