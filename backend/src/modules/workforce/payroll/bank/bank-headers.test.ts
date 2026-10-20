import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./bank-service', () => ({
  payoutView: vi.fn(),
  downloadBankFile: vi.fn(async () => ({ filename: 'bank-2026-09.csv', text: 'a,b', version: 1, hash: 'f'.repeat(64), repeat: false })),
}));
vi.mock('../exports/exports-service', () => ({
  exportMonth: vi.fn(async () => ({ filename: 'Payroll-2026-09.xlsx', contentType: 'application/octet-stream', documentNumber: 'PAY-2026-09', revision: 2, buffer: Buffer.from('x') })),
}));
vi.mock('../../rota/rota-http', () => ({ ok: vi.fn(), subjectOf: vi.fn(() => ({ id: 'u1' })) }));

import { exportsController } from '../exports/exports-controller';
import { bankController } from './bank-controller';

function fakeResponse(): { res: Response; headers: Map<string, string> } {
  const headers = new Map<string, string>();
  const res = { setHeader: (name: string, value: string) => void headers.set(name.toLowerCase(), value), send: vi.fn() } as unknown as Response;
  return { res, headers };
}

describe('download headers the browser must be able to read', () => {
  it('exposes the bank file hash, so Mark as paid can send it back', async () => {
    const { res, headers } = fakeResponse();
    await bankController.download({ params: { monthKey: '2026-09' }, body: { idempotencyKey: 'key-12345678' } } as unknown as Request, res);
    expect(headers.get('x-bank-file-hash')).toBe('f'.repeat(64));
    expect(headers.get('access-control-expose-headers')).toContain('X-Bank-File-Hash');
    expect(headers.get('access-control-expose-headers')).toContain('Content-Disposition');
  });

  it('exposes the document number and revision of an export', async () => {
    const { res, headers } = fakeResponse();
    await exportsController.export({ params: { monthKey: '2026-09' }, body: { kind: 'REGISTER', format: 'xlsx', idempotencyKey: 'key-12345678' } } as unknown as Request, res);
    expect(headers.get('access-control-expose-headers')).toContain('X-Document-Number');
    expect(headers.get('access-control-expose-headers')).toContain('X-Revision');
  });
});
