# Osler Wellness (Flow-first) — Full Bundle

This bundle contains:
- `netlify/functions/*` — serverless endpoints for **Shopify Flow** and a safe **Sync now** stub.
- `public/inventory.html` — Inventory page (adds a **Movement report** tab).
- `supabase/movement_report.sql` — adds the `v_ow_movement_report` view used by the Movement tab.
- `netlify.toml` — functions directory config.

## 1) Netlify environment (Project → Settings → Environment variables)
Set these (already in your account; verify values):
- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_SERVICE_ROLE` — service role key (server-side only)
- `FLOW_SHARED_SECRET` — `OslerHealth2727`
- (optional) `ENABLE_SYNC_NOW=1` if you later wire Shopify Admin API; otherwise sync is a no-op.

Deploy after saving variables.

## 2) Shopify Flow
Two actions pointing to your site:
- `https://<your-site>.netlify.app/.netlify/functions/shopify-flow` (use **SV** or **RH1** in `loc_code` in the body)
- `https://<your-site>.netlify.app/.netlify/functions/shopify-variant-upsert`

Headers:
- `Content-Type: application/json`
- `X-Flow-Secret: OslerHealth2727`

Bodies (examples):

```
{ "sku": "{{ productVariant.sku }}",
  "available": {% for L in productVariant.inventoryItem.inventoryLevels %}{% if L.location.name == "Star Vista Clinic" %}{{ L.available }}{% endif %}{% endfor %},
  "loc_code": "SV" }
```

```
{ "title": "{{ product.title }}",
  "sku": "{{ productVariant.sku }}",
  "barcode": "{{ productVariant.barcode }}",
  "price": {{ productVariant.price }} }
```

## 3) Supabase
Run `supabase/movement_report.sql` in the SQL editor (safe, idempotent).

## 4) Inventory page embed
Upload `public/inventory.html` and open it as you do today. It reads from `products_with_balances` and the movement tab reads from `v_ow_movement_report` (falling back to `movements_with_products`).

If your current page hard-codes the Supabase URL and anon key, replace the placeholders `%SUPABASE_URL%` and `%SUPABASE_ANON_KEY%` with your values; or define `window.SUPABASE_URL` and `window.SUPABASE_ANON_KEY` before this page loads.

## 5) Safety "Sync now"
The button posts to `/.netlify/functions/shopify-sync-now`. By default it returns `{ ok:true, skipped:true }` so **no error popups** if Admin API isn’t configured. You can enable a real sync later by setting `ENABLE_SYNC_NOW=1` and implementing the handler.
