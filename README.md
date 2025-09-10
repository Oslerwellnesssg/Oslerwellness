# Osler Wellness — Shopify Flow → Supabase → Plato

This repo contains Netlify Functions to receive Shopify Flow HTTP actions and update Supabase stock levels so your Plato app reflects inventory live.

## Environment variables (Netlify Site → Settings → Environment):
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- FLOW_SHARED_SECRET

## Endpoints
- `/.netlify/functions/health` — health check (GET)
- `/.netlify/functions/shopify-flow` — main inventory endpoint (POST)

### Request body expected by `shopify-flow`
```json
{ "sku": "ABC123", "available": 7, "loc_code": "SV" }
```

## Supabase migration
Run `supabase_migration_shopify_flow.sql` in the Supabase SQL editor.
