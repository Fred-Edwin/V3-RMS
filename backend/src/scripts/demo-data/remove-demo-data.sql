-- REMOVES the demo data listed in docs/features/inventory/demo-data.md. Real data is never touched: every row removed is matched by the word "DEMO".
-- Run:   ssh wendo 'cd ~/wendo-rms && docker compose exec -T postgres psql -U wendo_user -d wendo_rms -v ON_ERROR_STOP=1' < remove-demo-data.sql
-- Take a backup first (pg_dump), as for any production write.
--
-- Ledger rows: the database refuses DELETE on inventory_transactions. This script lifts that lock for this one transaction
-- (the same switch the dev seed scripts use), but ONLY while the ledger holds nothing except demo rows. If any real stock
-- movement exists, it stops with an error and removes nothing: past that point deleting would erase real history, and the
-- honest way out is take-back entries through the app.
begin;

do $$
begin
  if exists (select 1 from inventory_transactions where reason is distinct from 'DEMO · opening stock') then
    raise exception 'Real ledger rows exist. Stopping: deleting demo ledger rows would erase real history. Use take-back entries instead.';
  end if;
end $$;

select set_config('wendo.allow_ledger_edit', 'on', true);
delete from inventory_transactions where reason = 'DEMO · opening stock';

-- Demo restock levels: every level that has an "Opening setup · 6 Oct 2026" change row (or the older "DEMO · restock level"
-- wording, if rename-demo-markers.sql has not been run), plus all change rows for those levels (including any made live during
-- the demo, such as an edit and Put back).
create temp table demo_pairs on commit drop as
select distinct location_id, inventory_item_id from restock_level_changes
where reason in ('Opening setup · 6 Oct 2026', 'DEMO · restock level');
delete from restock_level_changes c using demo_pairs p where c.location_id = p.location_id and c.inventory_item_id = p.inventory_item_id;
delete from restock_levels r using demo_pairs p where r.location_id = p.location_id and r.inventory_item_id = p.inventory_item_id;

-- Demo contacts. Anything else the demo adds to a real supplier (a cheque payment method, a document) is removed in the app.
delete from supplier_contacts
where name in ('Sales desk', 'DEMO · Sales contact')
  and supplier_id = (select id from suppliers where name = 'Meadows Food Processors Ltd');

-- A demo item added live (name starts "Demo —"), with its history and supplier lines. Does nothing if there is none.
create temp table demo_items on commit drop as
select id from inventory_items where name like 'Demo —%';
delete from inventory_item_changes where inventory_item_id in (select id from demo_items);
delete from restock_level_changes where inventory_item_id in (select id from demo_items);
delete from restock_levels where inventory_item_id in (select id from demo_items);
delete from supplier_items where inventory_item_id in (select id from demo_items);
delete from inventory_items where id in (select id from demo_items);

select (select count(*) from inventory_transactions) ledger_rows_left,
       (select count(*) from restock_levels) restock_levels_left,
       (select count(*) from supplier_contacts where name in ('Sales desk', 'DEMO · Sales contact')) demo_contacts_left,
       (select count(*) from inventory_items) items_left;
commit;
