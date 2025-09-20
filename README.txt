Osler Wellness bundle — 2025-09-20T15:43:29.130258Z

Files:
- inventory.html  → Inventory table (unchanged look) with 'Movement report' link and 'Sync now' button.
- movement.html   → New report showing last 200 dispenses, split by SV and RH1. Links to Plato by Patient ID.
- records.html    → Placeholder so old links don't 404.
- package.json    → Adds node-fetch@2 for Netlify Function builds.

Deploy:
1) Copy these files into your repo ROOT (same folder as your existing inventory.html).
2) Commit and push to GitHub.
3) In Netlify, if you see 'Cannot find module node-fetch', click 'Clear cache and retry deploy'.

Plato:
- Left sidebar 'Osler Wellness' (clinic-wide) can target movement.html?url=...&token=...
- Inventory page has a button to open the movement report directly.

CSV templates:
- pricing_update.csv → columns: sku,price
- inventory_staging.csv → columns: sku,loc_code,on_hand (loc_code = 'SV' or 'RH1')

Bulk update (prices):
1) In Supabase > Table Editor, create table 'staging_prices(sku text primary key, price numeric)'
2) Import pricing_update.csv into 'staging_prices'.
3) Run:
   update public.products p
   set sell_price = s.price, updated_at = now()
   from staging_prices s
   where upper(p.sku) = upper(s.sku);

Bulk update (stock by CSV):
1) Ensure you have table public.staging_inventory(sku text, loc_code text, on_hand int).
2) Import inventory_staging.csv into public.staging_inventory.
3) Run:
   select public.load_staging_inventory('#2734');
4) Optionally truncate staging tables after apply.
