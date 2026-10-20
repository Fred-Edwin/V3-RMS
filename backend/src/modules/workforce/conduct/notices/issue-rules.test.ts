import { describe, expect, it } from 'vitest';
import { assertLevelAllowed } from './issue-rules';

describe('assertLevelAllowed', () => {
  it('allows a verbal note, a written warning and a final only as the ladder permits', () => {
    expect(() => assertLevelAllowed([], 'VERBAL_NOTE')).not.toThrow();
    expect(() => assertLevelAllowed([{ level: 'VERBAL_NOTE' }], 'WRITTEN_WARNING')).not.toThrow();
    expect(() => assertLevelAllowed([{ level: 'WRITTEN_WARNING' }], 'FINAL_WRITTEN_WARNING')).not.toThrow();
  });

  it('refuses a final warning without an active written warning', () => {
    expect(() => assertLevelAllowed([], 'FINAL_WRITTEN_WARNING')).toThrowError(expect.objectContaining({ statusCode: 409, code: 'FINAL_NEEDS_WRITTEN' }));
    expect(() => assertLevelAllowed([{ level: 'VERBAL_NOTE' }], 'FINAL_WRITTEN_WARNING')).toThrowError(expect.objectContaining({ code: 'FINAL_NEEDS_WRITTEN' }));
  });

  it('refuses every new notice while a final warning is on file', () => {
    for (const level of ['VERBAL_NOTE', 'WRITTEN_WARNING', 'FINAL_WRITTEN_WARNING'] as const) {
      expect(() => assertLevelAllowed([{ level: 'FINAL_WRITTEN_WARNING' }, { level: 'WRITTEN_WARNING' }], level)).toThrowError(expect.objectContaining({ statusCode: 409, code: 'FINAL_ALREADY_ACTIVE' }));
    }
  });
});
