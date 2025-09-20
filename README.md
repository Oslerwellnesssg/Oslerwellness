
# Osler Wellness App – Deployable Bundle

Generated: 2025-09-20T03:19:51.645105Z

This bundle contains:
- `netlify/functions` — Netlify Functions for Shopify Flow (variant upsert, inventory update), health, and a Flow-only sync endpoint.
- Front-end pages: `inventory.html` (with Movements tab), `dispense.html`, `records.html`, `privacy.html`.
- `netlify.toml` and `package.json` already configured.

## Environment variables (Netlify → Site settings → Environment variables)
- `FLOW_SHARED_SECRET` — must match the header you set in Shopify Flow.
- `SUPABASE_URL` — your Supabase project REST URL.
- `SUPABASE_SERVICE_ROLE` — service role key (used by functions only).
- (Optional) `DEFAULT_FLOW_LOCATION`, `PREORDER_TO_EMAIL`, `RESEND_API_KEY`, `STOCK_SET_PASSWORD` if you use them elsewhere.

## Endpoints you use in Shopify Flow
- Variant added → `/.netlify/functions/shopify-variant-upsert`
- Inventory quantity changed (per location) → `/.netlify/functions/shopify-flow`

## Inventory page usage
Load: `https://<your-site>.netlify.app/inventory.html?token=<SUPABASE_ANON_OR_SERVICE_KEY>&url=<SUPABASE_URL>`
The page shows Inventory and a Movements report (dispenses split into SV/RH1).

