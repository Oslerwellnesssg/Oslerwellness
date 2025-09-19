-- View for Osler Wellness movement report (dispense & preorder)
create or replace view public.v_ow_movement_report as
select
  t.created_at,
  t.patient_id,
  t.doctor_initials,
  p.name as product_name,
  p.sku,
  t.qty_out as quantity,
  coalesce(t.unit_price, p.sell_price) as price,
  coalesce(t.from_loc, t.to_loc) as location,
  case
    when t.type = 'dispense' then 'DISPENSED'
    when t.type = 'preorder' then 'PRE-ORDER'
    when t.voided then 'VOIDED'
    else upper(t.type::text)
  end as status
from public.transactions t
join public.products p on p.id = t.product_id
where t.voided = false
  and t.type in ('dispense','preorder')
order by t.created_at desc;
