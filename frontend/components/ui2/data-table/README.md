# Shared table (`ui2/data-table`)

The one table for the product (`docs/UI_BUILD_RULES.md` §4a). A feature passes **columns, filter definitions and a fetch
function**; it does not build a toolbar, a footer or URL handling.

## Adopting it

```tsx
<DataTable<StockRow>
  label="Stock items"
  columns={columns}
  getRowId={(r) => r.itemId}
  filters={filters}                       // chips + "Name · All" dropdowns, see below
  searchPlaceholder="Find an item"
  copy={STOCK_TABLE_COPY}                 // per-screen wording; the cards are the shared states kit
  onRowActivate={(r) => router.push(`/…/${r.itemId}`)}
  fetchRows={async (q, { signal }) => {
    const res = await stockApi.list({ search: q.search, page: q.page, pageSize: q.perPage, ...q.filters }, signal);
    return { rows: res.rows, total: res.total, counts: { attention: { '': res.total, low: res.low } } };
  }}
/>
```

- `fetchRows(query, { signal })` receives `{ page, perPage, search, filters }` and returns `{ rows, total, counts? }`.
  `total` is every row matching the search and filters, not the page. It runs when the URL state changes (search is debounced
  250 ms), never per keystroke; an inline function is fine. Pass `refreshToken` to reload after a save elsewhere on the screen.
- **Filters:** `{ kind: 'chips', key, options: [{ value: '', label: 'All' }, …] }` renders chips whose counts come from
  `counts[key][value]` (`''` is All). `{ kind: 'dropdown', key, label: 'Category', options }` renders "Category · All" at the right.
  Reuse the Catalog's names (Category, Type, Department, Section). Filter keys are the URL parameter names and the keys of
  `query.filters`.
- **Columns:** `cell(row, { term })`. Wrap the cells people search by in `<HighlightMatch text={…} term={term} />` for the bold
  matching letters. Numeric columns use `align: 'right'`.
- **URL:** `?page=&perPage=&search=&<filterKey>=`. Defaults are left out. Changing the search, a filter or rows per page
  returns to page 1; a page change pushes a history entry, the rest replace it. Other parameters (`?item=`) are kept.
  The search parameter is `search` by default (what Stock items and Prep history already used); set `searchParam` to change it.
- **States** (shared cards, per-screen `copy`): first-load skeleton rows with the header in place, empty, filtered-empty with
  "Clear filters", error with Retry, `permissionDenied`. Previous rows stay (dimmed) while a new page loads, so nothing jumps.
- **Keyboard:** with `onRowActivate`, rows take focus and open on Enter or Space; chips are buttons with `aria-pressed`; the
  focus ring is the token ring.
- **Drag-to-reorder lists** (Count setup): `paged={false}` shows the whole section on one scrollable list (`maxBodyHeight`), no
  pager, no `page`/`perPage` in the URL, and `fetchRows` is called with `perPage: 0` (`UNPAGED`) meaning "all". The drag
  behaviour stays the feature's own.

## Backend contract it expects

A list endpoint takes `page`, `perPage` (or `pageSize`; 25, 50 and 100 must all be allowed, so max ≥ 100), the search text and
each filter, and returns `total`. Chip counts come from the same call or a summary call the feature merges into `counts`.

## Owner-unconfirmed (8 Oct 2026), easy to change

Both live in `table-query.ts`: the sizes `PER_PAGE_OPTIONS = [25, 50, 100]` with `DEFAULT_PER_PAGE = 50`, and holding the state in the
URL (`parseTableQuery` / `writeTableQuery`).

## Not covered by unit tests

The repo has no DOM test library (`vitest` runs in node). The rules (URL round-trip, page reset, page list, match splitting) and the
rendered states (loading, permission, toolbar, pager) are tested in `table-query.test.ts` and `data-table.test.ts`. Debounce,
Back/refresh and keyboard behaviour are checked in the browser per screen.
