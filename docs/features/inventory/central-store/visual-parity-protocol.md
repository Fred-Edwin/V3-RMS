# Visual parity protocol (Paper → built page)

Goal: every built screen matches its Paper artboard, checked fast. This reuses the per-screen gate in `../milestone-6-plan.md` §4.4 and replaces its slow parts with a measured check. Standing rules still apply: **no automated pixel-diff** (pixelmatch is banned), no end-of-session batch checking, never take values from screenshots.

## Principles

1. **Components first.** Build from `frontend/components/ui2/` and the `wds-` tokens. Do not restyle a primitive for one screen. If Paper differs from a primitive, fix the primitive once and say so in the log.
2. **Numbers from Paper, not eyes.** Read values with `get_jsx` and `get_computed_styles`. Screenshots are only for the final look.
3. **Check per screen, right after building it.** Not at the end of the session.
4. **Spend effort where it pays.** Three tiers:

| Tier | What | Check |
|---|---|---|
| A. New layout | First time a layout appears (catalog list, item drawer, supplier tab, Add payment method drawer, phone form, KPI strip) | Full check below |
| B. Variant | Same layout, different text or data (9b, 1b, Cheque row, Stocked/Raw/Prepped labels, Housekeeping chip) | Anchor check on the changed element + one screenshot pair |
| C. Dimmed background copy | The dimmed parent screen behind a drawer or dialog | Skip. It is the real screen under a dim overlay |

## The check for a Tier A screen (about 10 minutes)

1. **Spec.** `get_jsx` on the artboard, plus `get_computed_styles` on 6 to 8 anchor nodes: page title, KPI cell (label, value, sub-text), table header cell, table row, primary button, a chip, an input, and for drawers the drawer itself (width, padding, header). Note token names, not just hex.
2. **Build** the screen.
3. **Measure the live page.** Open it at the artboard's size (desktop 1440×900, phone 390×844) with the chrome-devtools MCP. One `evaluate_script` call reads `getComputedStyle` for the same anchors (find them by visible text) and returns font size, weight, line height, colour, padding, gap, height, width, border colour and radius. Compare to the Paper values. Any difference over 1px, or a colour that resolves to a different token, is a defect.
4. **Look.** Screenshot the Paper artboard and the live page, in the same state, side by side. By eye: spacing rhythm, hairlines, alignment lanes, wrapping, primary-button gradient.
5. **Fix and re-measure** only the anchors that failed.
6. **Log** one line in the session outcome log: screen, tier, anchors checked, deviations and why.

The interaction audit (hover, focus, in-flight, error) and `web-design-guidelines` pass from §4.2 to §4.4 of the M6 plan still run per Tier A screen. They are separate from parity.

## Rules that save time

- Seed the data so the live page matches the artboard's running example (Mon 12 Oct 2026, Samrat, Brown sugar). Mismatched data makes comparison slow.
- Wrapping is the usual defect: chips, prices and status text need `whitespace-nowrap` and `shrink-0` where Paper shows one line.
- Rows with and without a trailing glyph must have equal label-row heights (KPI strips misaligned this way in Paper).
- Do not chase 1px anti-aliasing differences between Paper and the browser. Compare values, not rendering.
- If Paper itself looks wrong (overflow, odd gap), do not copy the flaw. Stop and ask the owner; do not decide silently.
- A deviation needs the owner's yes. List it in the log with the reason.

## Parity done means

Every Tier A screen has a log line with measured anchors and zero open deviations; every Tier B screen has its anchor check and a screenshot pair; the owner has seen a side-by-side of each new layout.
