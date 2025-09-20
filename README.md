# Osler Wellness (Plato + Shopify stock → Supabase)

This repository hosts the static pages (`records.html`, `inventory.html`, `dispense.html`) and Netlify Functions for syncing Shopify inventory to Supabase.

## Environment variables (Netlify → Site settings → Build & deploy → Environment)
- `SUPABASE_URL` = `https://zwocjuiqkmfgtenzjdcy.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = **your Supabase service role key (server-side only)**
- `FLOW_SHARED_SECRET` = a shared secret you create (used by Shopify Flow Authorization header)

> Do **not** expose the service role key to the browser. The front‑end only uses the anon key embedded in HTML.

## Shopify Flow setup
Create one workflow that triggers on **Product variant inventory quantity changed**. Add two branches (location == *Star Vista Clinic* and location == *Raffles Clinic*), each with **Send HTTP request** action.

**Request**
- Method: `POST`
- URL: `https://oslerwellness.netlify.app/.netlify/functions/shopify-flow`
- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer { secrets.FlowSharedSecret }`

**Body (SV branch)**
```json
{ "sku": { productVariant.sku | json }, "available": { productVariant.inventoryQuantity }, "loc_code": "SV" }
```

**Body (RH1 branch)**
```json
{ "sku": { productVariant.sku | json }, "available": { productVariant.inventoryQuantity }, "loc_code": "RH1" }
```

**Secrets in Flow**
- Create a secret named `FlowSharedSecret` with the **exact same value** as Netlify `FLOW_SHARED_SECRET`.

## Endpoints
- Health check: `https://oslerwellness.netlify.app/.netlify/functions/health`
- Shopify Flow receiver (POST only): `https://oslerwellness.netlify.app/.netlify/functions/shopify-flow`
