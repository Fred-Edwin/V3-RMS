import { describe, expect, it } from 'vitest';
import { DISPATCH_STAGES, DISPATCH_STAGE_TEXT } from '../types/dispatch-contract';
import { DISPATCH_STATE_ROWS, DISPATCH_WORDING_ROWS } from './states-copy';

describe('dispatch wording skeleton (Paper D21)', () => {
  it('draws eight states, each a stage of the contract, named as the contract names it', () => {
    expect(DISPATCH_STATE_ROWS).toHaveLength(8);
    for (const row of DISPATCH_STATE_ROWS) {
      expect(DISPATCH_STAGES).toContain(row.stage);
      expect(row.state).toBe(DISPATCH_STAGE_TEXT[row.stage]);
    }
  });

  it('the quiet Confirmed stage has no row: a clean count closes at once', () => {
    expect(DISPATCH_STATE_ROWS.map((r) => r.stage)).not.toContain('CONFIRMED');
  });

  it('seven wording moments, no person names, every moment has words', () => {
    expect(DISPATCH_WORDING_ROWS).toHaveLength(7);
    for (const row of DISPATCH_WORDING_ROWS) {
      expect(row.words.length).toBeGreaterThan(0);
      expect(row.whoSeesIt).not.toMatch(/Peter|Joseph|Grace|Samuel/);
    }
  });
});
