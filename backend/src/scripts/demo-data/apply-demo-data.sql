-- DEMO DATA for the client demo (6 Oct 2026). Everything here carries the word "DEMO" so it can be found and removed.
-- Run:   ssh wendo 'cd ~/wendo-rms && docker compose exec -T postgres psql -U wendo_user -d wendo_rms -v ON_ERROR_STOP=1' < apply-demo-data.sql
-- Undo:  remove-demo-data.sql (same way). The list of demo rows is in docs/features/inventory/demo-data.md.
-- Safe to re-run: rows are skipped when they already exist.
begin;

-- 1. Restock levels set on 6 Oct 2026 carry the reason "Demo levels"; rename it to the neutral marker (see rename-demo-markers.sql).
update restock_level_changes set reason = 'Opening setup · 6 Oct 2026' where reason in ('Demo levels', 'DEMO · restock level');

-- 2. Opening stock, so the Restock page shows a mix of OK, Low and Out. Items left out of the list stay at 0 (Out).
--    Central Store rows are RECEIVE, branch department rows are DISPATCH_IN (as the rehearsal seed does).
create temp table demo_stock(loc text, item text, qty numeric) on commit drop;
insert into demo_stock values
('Central Store','Sugar, white',80),
('Central Store','Cooking oil',15),
('Central Store','Wheat flour',140),
('Central Store','Rice, guest',30),
('Central Store','Milk',90),
('Central Store','Coffee beans',10),
('Central Store','Tomato ketchup',36),
('Central Store','Salt',25),
('Central Store','Toilet tissue',12),
('Central Store','Chicken, cut',75),
('Nyeri Town — Kitchen','Sugar, white',14),
('Nyeri Town — Kitchen','Cooking oil',4),
('Nyeri Town — Kitchen','Rice, guest',25),
('Nyeri Town — Kitchen','Mayonnaise',2),
('Nyeri Town — Barista','Coffee beans',11),
('Nyeri Town — Barista','Milk',12),
('Nyeri Town — Barista','Tea leaves',6);

insert into inventory_transactions(id, organization_id, location_id, inventory_item_id, type, quantity, unit_cost, reason, user_id)
select gen_random_uuid(), l.organization_id, l.id, i.id,
       case when l.type = 'CENTRAL_STORE' then 'RECEIVE'::"InventoryTransactionType" else 'DISPATCH_IN'::"InventoryTransactionType" end,
       d.qty, i.current_cost, 'DEMO · opening stock',
       (select id from users where email = 'store.manager@wendo.co.ke')
from demo_stock d
join locations l on l.name = d.loc
join inventory_items i on i.name = d.item and i.organization_id = '2223e6f9-1567-42a8-b1b6-50a86b288863' and i.deleted_at is null
where not exists (
  select 1 from inventory_transactions t
  where t.location_id = l.id and t.inventory_item_id = i.id and t.reason = 'DEMO · opening stock');

-- 3. One contact for Meadows (it had none), so the Contacts tab is not empty.
insert into supplier_contacts(id, organization_id, supplier_id, name, phone, is_primary, updated_at)
select gen_random_uuid(), s.organization_id, s.id, 'Sales desk', '0700 000 000', true, now()
from suppliers s
where s.name = 'Meadows Food Processors Ltd'
  and not exists (select 1 from supplier_contacts c where c.supplier_id = s.id);

select (select count(*) from inventory_transactions where reason = 'DEMO · opening stock') demo_ledger_rows,
       (select count(*) from restock_level_changes where reason = 'Opening setup · 6 Oct 2026') demo_level_changes,
       (select count(*) from supplier_contacts where name = 'Sales desk') demo_contacts;
commit;
