import { Controller, Get, Query, Res } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { CurrentUser } from '@auth/current-user.decorator';
import type { JwtAuthPayload } from '@auth/jwt-auth.guard';
import { ProtectedApi } from '@auth/auth-api.decorator';
import { DEFAULT_PAGE, MAX_PAGE_SIZE } from '@common/constants/pagination.constants';
import { SkipApiResponse } from '@common/decorators/api-response.decorator';
import { DebtsService } from '@modules/protected/debts/debts.service';

@ProtectedApi()
@SkipApiResponse()
@Controller('exports')
export class ExportsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Get('debts')
  async debts(@CurrentUser() user: JwtAuthPayload, @Query() query: Record<string, string | undefined>, @Res() response: Response) {
    const debts = await this.debtsService.list(user.organizationId, {
      ...query,
      page: DEFAULT_PAGE,
      pageSize: MAX_PAGE_SIZE,
    });
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
    debts.items.forEach((debt) => {
      sheet.addRow({
        code: debt.code,
        party: debt.party.name,
        type: debt.type,
        originalAmount: debt.originalAmount.toString(),
        paidAmount: debt.paidAmount.toString(),
        dueDate: debt.dueDate.toISOString().slice(0, 10),
        status: debt.status,
      });
    });

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader('Content-Disposition', 'attachment; filename="debtflow-debts.xlsx"');
    await workbook.xlsx.write(response);
    response.end();
  }
}
