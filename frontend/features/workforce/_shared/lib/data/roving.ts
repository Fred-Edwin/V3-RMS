/**
 * Arrow-key movement for a group that is one tab stop (tabs, segmented control,
 * option lists). Left/Up go back, Right/Down go forward, Home and End jump; the
 * move wraps. Returns the value to select, or `null` when the key is not ours.
 */
export function nextInGroup(key: string, values: readonly string[], current: string, disabled: ReadonlySet<string> = new Set()): string | null {
  const enabled = values.filter((v) => !disabled.has(v));
  if (enabled.length === 0) return null;
  const at = enabled.indexOf(current);
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return enabled[(at + 1 + enabled.length) % enabled.length] ?? null;
    case 'ArrowLeft':
    case 'ArrowUp':
      return enabled[(at - 1 + enabled.length) % enabled.length] ?? null;
    case 'Home':
      return enabled[0] ?? null;
    case 'End':
      return enabled[enabled.length - 1] ?? null;
    default:
      return null;
  }
}
