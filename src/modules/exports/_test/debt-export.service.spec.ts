import { describe, expect, it, vi } from 'vitest';
import * as ExcelJS from 'exceljs';
import { Prisma } from '@generated/prisma/client.js';
import { DebtExportService } from '../debt-export.service.js';

describe('DebtExportService', () => {
  it('preserves tenant/filter scope, caps export rows and writes exact monetary strings', async () => {
    const list = vi.fn().mockResolvedValue({
      items: [
        {
          code: 'D-1',
          party: { name: 'Example' },
          type: 'RECEIVABLE',
          originalAmount: new Prisma.Decimal('9007199254740993.25'),
          paidAmount: new Prisma.Decimal('0.05'),
          dueDate: new Date('2026-11-01T00:00:00Z'),
          status: 'PARTIAL',
        },
      ],
    });
    const service = new DebtExportService({ list } as never);
    const filters = { where: { partyId: 'p1' } };
    const query = { page: 99, pageSize: 1, partyId: 'p1' };
    const buffer = await service.build('org-1', query, filters as never);
    expect(list).toHaveBeenCalledWith('org-1', { ...query, page: 1, pageSize: 1000 }, filters);
    expect(query.page).toBe(99);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    expect(workbook.worksheets[0].getRow(2).values).toEqual([
      undefined,
      'D-1',
      'Example',
      'RECEIVABLE',
      '9007199254740993.25',
      '0.05',
      '2026-11-01',
      'PARTIAL',
    ]);
  });

  it('propagates a failed scoped read rather than generating a successful export', async () => {
    const list = vi.fn().mockRejectedValue(new Error('read failed'));
    await expect(new DebtExportService({ list } as never).build('org-1', {})).rejects.toThrow(
      'read failed',
    );
  });
});
