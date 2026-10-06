-- Renames the two client-visible demo markers to neutral wording (6 Oct 2026). Safe to re-run.
-- Run:   ssh wendo 'cd ~/wendo-rms && docker compose exec -T postgres psql -U wendo_user -d wendo_rms -v ON_ERROR_STOP=1' < rename-demo-markers.sql
--
-- The 17 opening-stock ledger rows keep the reason "DEMO · opening stock": the ledger cannot be edited, and that text only shows on
-- the old Stock ledger screen. remove-demo-data.sql finds the restock rows by the new wording and the ledger rows by the old one.
begin;

update restock_level_changes set reason = 'Opening setup · 6 Oct 2026' where reason = 'DEMO · restock level';

update supplier_contacts set name = 'Sales desk'
where name = 'DEMO · Sales contact'
  and supplier_id = (select id from suppliers where name = 'Meadows Food Processors Ltd');

select (select count(*) from restock_level_changes where reason = 'Opening setup · 6 Oct 2026') restock_rows_renamed,
       (select count(*) from supplier_contacts where name = 'Sales desk') contacts_renamed,
       (select count(*) from restock_level_changes where reason like 'DEMO%') old_restock_marker_left;
commit;
