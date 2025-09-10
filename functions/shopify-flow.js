const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const STOCK_SET_PASSWORD = process.env.STOCK_SET_PASSWORD || "#2734";
const DEFAULT_FLOW_LOCATION = process.env.DEFAULT_FLOW_LOCATION || "SV";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function logEvent(raw, partial) {
  try { await sb.from("shopify_events").insert([{ raw, ...partial }]); } catch {}
}

async function resolveProductId(sku) {
  let { data: p1 } = await sb.from("products").select("id").eq("barcode", sku).maybeSingle();
  if (p1) return p1.id;
  let { data: p2 } = await sb.from("products").select("id").eq("sku", sku).maybeSingle();
  if (p2) return p2.id;
  let { data: a1 } = await sb.from("product_sku_aliases").select("product_id").eq("alias", sku).maybeSingle();
  if (a1) return a1.product_id;
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { await logEvent({ parse_error: event.body }, { status: "bad_request", error: "invalid json" }); return { statusCode: 400, body: "invalid json" }; }

  let { sku, available, loc_code } = body;
  const loc = (loc_code || DEFAULT_FLOW_LOCATION);
  if (!sku || typeof available !== "number" || !["RH1","SV"].includes(loc)) {
    await logEvent(body, { status: "bad_request", error: "missing/invalid fields" });
    return { statusCode: 400, body: "missing/invalid fields" };
  }

  try {
    const productId = await resolveProductId(String(sku));
    if (!productId) {
      await logEvent(body, { sku, available, loc_code: loc, status: "no_product" });
      return { statusCode: 404, body: "no product for " + sku };
    }
    // keep the other location unchanged
    const { data: rh1 } = await sb.from("stock_levels").select("on_hand").eq("product_id", productId).eq("location", "RH1").maybeSingle();
    const { data: sv  } = await sb.from("stock_levels").select("on_hand").eq("product_id", productId).eq("location", "SV").maybeSingle();
    let qRH1 = (rh1 && rh1.on_hand) || 0;
    let qSV  = (sv  && sv.on_hand)  || 0;
    if (loc === "RH1") qRH1 = available; else qSV = available;

    const { error: rpcErr } = await sb.rpc("set_stock_quantities", {
      p_password: STOCK_SET_PASSWORD,
      p_product: productId,
      p_rh1: qRH1,
      p_sv: qSV,
      p_new_name: null, p_new_barcode: null, p_new_price: null
    });
    if (rpcErr) {
      await logEvent(body, { sku, available, loc_code: loc, product_id: productId, status: "rpc_error", error: rpcErr.message });
      return { statusCode: 500, body: "rpc error: " + rpcErr.message };
    }
    await logEvent(body, { sku, available, loc_code: loc, product_id: productId, status: "ok" });
    return { statusCode: 200, body: JSON.stringify({ ok: true, product_id: productId, location: loc, available }) };
  } catch (e) {
    await logEvent(body, { sku, available, loc_code: loc, status: "rpc_error", error: e.message });
    return { statusCode: 500, body: "unhandled: " + e.message };
  }
};
