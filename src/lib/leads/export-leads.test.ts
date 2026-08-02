import { describe, expect, it } from 'vitest';

import { buildLeadsWorkbook, type ExportLead } from './export-leads';

const sampleLeads: ExportLead[] = [
  {
    classification: 'interested',
    interest_level: 'high',
    ai_summary: 'Cliente quiere una demo del producto.',
    contacts: { name: 'Ana López', phone: '+34 600 123 456', company: 'Acme' },
  },
  {
    classification: 'not_interested',
    interest_level: 'low',
    ai_summary: null,
    contacts: { name: 'Bob, Smith', phone: '+1 555 000', company: 'Co, LLC' },
  },
  {
    classification: 'needs_info',
    interest_level: null,
    ai_summary: 'Pidió más info sobre precios.',
    contacts: null,
  },
];

describe('buildLeadsWorkbook', () => {
  it('produces a valid xlsx (ZIP magic bytes PK) buffer', async () => {
    const workbook = await buildLeadsWorkbook(sampleLeads, {
      broadcastName: 'Campánía Verano',
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const bytes = new Uint8Array(buffer);

    // XLSX is a ZIP container; must start with 'PK'
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K
  });

  it('writes the expected header row in order', async () => {
    const workbook = await buildLeadsWorkbook(sampleLeads);
    const sheet = workbook.getWorksheet(1)!;
    const headers = sheet.getRow(1).values as unknown[];
    // row.values[0] is undefined (exceljs indexing starts at 1)
    expect(headers.slice(1, 7)).toEqual([
      'Empresa',
      'Contacto',
      'Teléfono',
      'Estado',
      'Nivel de interés',
      'Resumen IA',
    ]);
  });

  it('writes one data row per lead (rowCount = leads + 1 header)', async () => {
    const workbook = await buildLeadsWorkbook(sampleLeads);
    const sheet = workbook.getWorksheet(1)!;
    // actualRowCount counts header + data rows that have content
    expect(sheet.actualRowCount).toBe(sampleLeads.length + 1);
  });

  it('maps classification and interest_level to Spanish labels', async () => {
    const workbook = await buildLeadsWorkbook(sampleLeads);
    const sheet = workbook.getWorksheet(1)!;
    const row1 = sheet.getRow(2).values as unknown[];
    expect(row1[4]).toBe('Interesado'); // Estado
    expect(row1[5]).toBe('Alto'); // Nivel de interés

    const row2 = sheet.getRow(3).values as unknown[];
    expect(row2[4]).toBe('No interesado');
    expect(row2[5]).toBe('Bajo');
  });

  it('handles commas in fields without corrupting cells', async () => {
    const workbook = await buildLeadsWorkbook(sampleLeads);
    const sheet = workbook.getWorksheet(1)!;
    const row = sheet.getRow(3).values as unknown[];
    // Comma in company and contact must be preserved verbatim
    expect(row[1]).toBe('Co, LLC');
    expect(row[2]).toBe('Bob, Smith');
  });

  it('handles null contacts gracefully', async () => {
    const workbook = await buildLeadsWorkbook(sampleLeads);
    const sheet = workbook.getWorksheet(1)!;
    const row = sheet.getRow(4).values as unknown[];
    expect(row[1]).toBe('');
    expect(row[2]).toBe('');
    expect(row[3]).toBe('');
    expect(row[4]).toBe('Requiere asesor');
  });

  it('has freeze on the first row', async () => {
    const workbook = await buildLeadsWorkbook(sampleLeads);
    const sheet = workbook.getWorksheet(1)!;
    const view = sheet.views?.[0] as { state?: string; ySplit?: number };
    expect(view?.state).toBe('frozen');
    expect(view?.ySplit).toBe(1);
  });

  it('enables auto-filter', async () => {
    const workbook = await buildLeadsWorkbook(sampleLeads);
    const sheet = workbook.getWorksheet(1)!;
    expect(sheet.autoFilter).toBeDefined();
  });

  it('returns an empty body workbook when no leads (header only)', async () => {
    const workbook = await buildLeadsWorkbook([]);
    const sheet = workbook.getWorksheet(1)!;
    expect(sheet.actualRowCount).toBe(1);
  });
});