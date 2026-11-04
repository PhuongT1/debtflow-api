import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { DEFAULT_PAGE, MAX_PAGE_SIZE } from '#common/constants/pagination.constants.js';
import type { ListQueryResult } from '#common/query/index.js';
import { DebtsService } from '#modules/debts/public/debts.js';
import type { QueryDebtsDto } from '#modules/debts/public/debts.js';

/** Owns the documented capped export; transport headers and response handling stay in the controller. */
@Injectable()
export class DebtExportService {
  constructor(private readonly debtsService: DebtsService) {}

  async build(organizationId: string, query: QueryDebtsDto, listQuery?: ListQueryResult) {
    const debts = await this.debtsService.list(
      organizationId,
      {
        ...query,
        page: DEFAULT_PAGE,
        pageSize: MAX_PAGE_SIZE,
      },
      listQuery,
    );
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Cong no');
    sheet.columns = [
      { header: 'Mã', key: 'code', width: 18 },
      { header: 'Đối tác', key: 'party', width: 28 },
      { header: 'Loại', key: 'type', width: 14 },
      { header: 'Số tiền', key: 'originalAmount', width: 18 },
      { header: 'Đã trả', key: 'paidAmount', width: 18 },
      { header: 'Ngày hạn', key: 'dueDate', width: 18 },
      { header: 'Trạng thái', key: 'status', width: 16 },
    ];
    for (const debt of debts.items) {
      sheet.addRow({
        code: debt.code,
        party: debt.party.name,
        type: debt.type,
        originalAmount: debt.originalAmount.toString(),
        paidAmount: debt.paidAmount.toString(),
        dueDate: debt.dueDate.toISOString().slice(0, 10),
        status: debt.status,
      });
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
