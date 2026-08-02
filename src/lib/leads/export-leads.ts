import ExcelJS from 'exceljs';

import { getClassificationLabel, getInterestLabel } from './format';

/**
 * Minimal lead shape consumed by the Excel exporter. Kept structural
 * (not importing the component-defined `CampaignLead` interface) so the
 * util stays decoupled from React and easy to unit-test.
 */
export interface ExportLead {
  classification: string;
  interest_level: string | null;
  ai_summary: string | null;
  contacts?: {
    name: string | null;
    phone: string | null;
    company: string | null;
  } | null;
}

export interface ExportLeadsToExcelOptions {
  /** Broadcast name used for the file slug + sheet title. */
  broadcastName?: string;
}

const COLUMNS = [
  { header: 'Empresa', key: 'company', width: 24 },
  { header: 'Contacto', key: 'contact', width: 24 },
  { header: 'Teléfono', key: 'phone', width: 18 },
  { header: 'Estado', key: 'status', width: 20 },
  { header: 'Nivel de interés', key: 'interest', width: 18 },
  { header: 'Resumen IA', key: 'summary', width: 60 },
] as const;

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  left: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  right: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
};

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function todayStamp(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Build a styled `.xlsx` workbook (in memory) from the given leads.
 *
 * Pure / async — no DOM access — so it is safe to unit-test in a Node
 * environment. The companion `exportLeadsToExcel` wrapper handles the
 * browser download.
 *
 * Styling mirrors the on-screen table: bold header row with brand fill,
 * frozen header, auto-filter, wrapped "Resumen IA" column, thin borders
 * and zebra striping for readability.
 */
export async function buildLeadsWorkbook(
  leads: ExportLead[],
  options: ExportLeadsToExcelOptions = {},
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CRM Leads IA';
  workbook.created = new Date();

  const sheetTitle = options.broadcastName
    ? options.broadcastName.slice(0, 31)
    : 'Leads';
  const sheet = workbook.addWorksheet(sheetTitle, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // Columns + header styling
  sheet.columns = COLUMNS.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.border = THIN_BORDER;
  headerRow.height = 22;

  // Auto-filter across all columns
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMNS.length },
  };

  // Data rows
  leads.forEach((lead, index) => {
    const row = sheet.addRow({
      company: lead.contacts?.company || '',
      contact: lead.contacts?.name || '',
      phone: lead.contacts?.phone || '',
      status: getClassificationLabel(lead.classification),
      interest: getInterestLabel(lead.interest_level),
      summary: lead.ai_summary || '',
    });

    row.border = THIN_BORDER;
    row.alignment = { vertical: 'top', wrapText: false };

    // Wrap only the summary cell
    const summaryCell = row.getCell('summary');
    summaryCell.alignment = { vertical: 'top', wrapText: true };

    // Zebra striping
    if (index % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' },
        };
      });
    }
  });

  return workbook;
}

/**
 * Build an `.xlsx` workbook from the given leads and trigger a browser
 * download. Fully client-side — no server round-trip, no new API route,
 * no changes to RLS or auth.
 */
export async function exportLeadsToExcel(
  leads: ExportLead[],
  options: ExportLeadsToExcelOptions = {},
): Promise<void> {
  const workbook = await buildLeadsWorkbook(leads, options);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const slug = options.broadcastName ? slugify(options.broadcastName) : 'all';
  a.download = `leads-${slug}-${todayStamp()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}