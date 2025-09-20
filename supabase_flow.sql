-- === Core objects (products, stock_levels, transactions, views, functions) ===
-- (Use the version you've already run; this file appends the Flow apply RPC in case it's missing)

create table if not exists public.shopify_events (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  raw jsonb not null,
  sku text,
  available int,
  loc_code text,
  product_id uuid,
  status text,
  error text
);

create table if not exists public.product_sku_aliases (
  product_id uuid not null references public.products(id) on delete cascade,
  alias text not null unique,
  created_at timestamptz not null default now(),
  primary key (alias)
);

create index if not exists shopify_events_received_idx on public.shopify_events(received_at desc);
create index if not exists shopify_events_sku_idx on public.shopify_events(sku);

create or replace view public.shopify_events_recent as
select id, received_at, sku, available, loc_code, product_id, status, error
from public.shopify_events
order by received_at desc
limit 50;

-- Map incoming (sku, loc_code, available) to stock_levels
create or replace function public.apply_shopify_flow(p_sku text, p_loc_code text, p_available int)
returns void language plpgsql as $$
declare v_prod uuid; v_alias uuid; v_loc text;
begin
  v_loc := upper(p_loc_code);
  -- Find product by sku or alias (case-insensitive)
  select id into v_prod from public.products where upper(sku) = upper(p_sku) limit 1;
  if v_prod is null then
    select product_id into v_prod from public.product_sku_aliases where upper(alias) = upper(p_sku) limit 1;
  end if;
  if v_prod is null then
    insert into public.shopify_events(raw, sku, available, loc_code, status, error)
    values (jsonb_build_object('note','unknown sku'), p_sku, p_available, p_loc_code, 'error', 'SKU not found');
    return;
  end if;

  -- Ensure stock row
  insert into public.stock_levels(product_id, location, on_hand)
  values (v_prod, v_loc, 0)
  on conflict (product_id, location) do nothing;

  -- Set quantity (convert to an 'adjust' movement to reconcile to target available)
  perform public.set_stock_quantities('#2734', v_prod,
           case when v_loc='RH1' then p_available else (select on_hand from public.stock_levels where product_id=v_prod and location='RH1') end,
           case when v_loc='SV'  then p_available else (select on_hand from public.stock_levels where product_id=v_prod and location='SV')  end);

  update public.shopify_events
     set product_id = v_prod, status='applied', error=null
   where id in (select id from public.shopify_events where sku = p_sku order by received_at desc limit 1);
end$$;

-- RLS & grants (open)
alter table if exists public.product_sku_aliases enable row level security;
alter table if exists public.shopify_events      enable row level security;
drop policy if exists p_all_product_sku_aliases on public.product_sku_aliases;
create policy p_all_product_sku_aliases on public.product_sku_aliases for all using (true) with check (true);
drop policy if exists p_all_shopify_events on public.shopify_events;
create policy p_all_shopify_events on public.shopify_events for all using (true) with check (true);

-- Realtime publication (idempotent)
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.shopify_events';      exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.product_sku_aliases'; exception when others then null; end;
end$$;
