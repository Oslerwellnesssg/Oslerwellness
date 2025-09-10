-- Osler Wellness — Shopify Flow → Supabase bridge (add-on migration)
-- Safe to run multiple times.
begin;

create extension if not exists pgcrypto;

-- Tables that may already exist in your schema
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

-- Helper to resolve product by SKU or alias
create or replace function public.find_product_by_sku_or_alias(p_sku text)
returns uuid language sql stable as $$
  select id from public.products where upper(sku) = upper(p_sku)
  union
  select product_id from public.product_sku_aliases where upper(alias) = upper(p_sku)
  limit 1
$$;

-- Exact-level setter from Shopify Flow
-- p_loc_code should be 'SV' or 'RH1' (case-insensitive)
create or replace function public.apply_shopify_flow(
  p_sku text,
  p_loc_code text,
  p_available int
) returns void language plpgsql as $$
declare
  v_product uuid;
  v_loc text;
  v_current int;
  v_diff int;
begin
  if p_sku is null or p_loc_code is null or p_available is null then
    raise exception 'Missing sku/loc/available';
  end if;

  v_loc := upper(p_loc_code);
  if v_loc not in ('SV','RH1') then
    raise exception 'Invalid loc_code % (expected SV or RH1)', v_loc;
  end if;

  select public.find_product_by_sku_or_alias(p_sku) into v_product;
  if v_product is null then
    raise exception 'No product found for SKU/Alias %', p_sku;
  end if;

  perform public.ensure_stock_row(v_product, v_loc);

  select on_hand into v_current
    from public.stock_levels
   where product_id = v_product and location = v_loc
   for update;

  v_current := coalesce(v_current, 0);
  v_diff := p_available - v_current;

  if v_diff = 0 then
    return;
  end if;

  update public.stock_levels
     set on_hand = p_available, updated_at = now()
   where product_id = v_product and location = v_loc;

  if v_diff > 0 then
    insert into public.transactions(type, product_id, to_loc, qty_in, remarks)
    values ('adjust', v_product, v_loc, v_diff, 'Shopify Flow set qty');
  else
    insert into public.transactions(type, product_id, from_loc, qty_out, remarks)
    values ('adjust', v_product, v_loc, -v_diff, 'Shopify Flow set qty');
  end if;

  -- optional: link back the product id in the log table
  update public.shopify_events
     set product_id = v_product, status = 'applied'
   where id in (select id from public.shopify_events order by received_at desc limit 1);
end$$;

-- RLS open (match your current style)
alter table if exists public.shopify_events enable row level security;
drop policy if exists p_all_shopify_events on public.shopify_events;
create policy p_all_shopify_events on public.shopify_events for all using (true) with check (true);

alter table if exists public.product_sku_aliases enable row level security;
drop policy if exists p_all_product_sku_aliases on public.product_sku_aliases;
create policy p_all_product_sku_aliases on public.product_sku_aliases for all using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant all on public.shopify_events, public.product_sku_aliases to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

grant execute on function public.find_product_by_sku_or_alias(text) to anon, authenticated;
grant execute on function public.apply_shopify_flow(text,text,int) to anon, authenticated;

-- Publish to realtime so UI refreshes
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.stock_levels'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.transactions'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.shopify_events'; exception when others then null; end;
end $$;

commit;
