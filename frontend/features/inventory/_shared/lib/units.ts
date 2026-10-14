/**
 * Which units take a decimal point on the number pad: weight and volume do ("1.5 kg", "0.75 L"); a count of things does not
 * ("3 crates", "12 pcs"). Used by every screen that draws a `QuantityField`. An unknown unit gets the decimal point, because
 * being able to type 2.5 is a smaller problem than not being able to.
 */
const WHOLE = new Set(['pcs', 'pc', 'piece', 'pieces', 'each', 'unit', 'units', 'packet', 'packets', 'pack', 'packs', 'box', 'boxes', 'bag', 'bags', 'crate', 'crates', 'bottle', 'bottles', 'tin', 'tins', 'can', 'cans', 'carton', 'cartons', 'dozen', 'tray', 'trays', 'sack', 'sacks', 'jar', 'jars', 'roll', 'rolls', 'bunch', 'bunches', 'loaf', 'loaves', 'sachet', 'sachets', 'case', 'cases']);

export const allowsDecimal = (unit: string | null | undefined): boolean => !WHOLE.has((unit ?? '').trim().toLowerCase());
