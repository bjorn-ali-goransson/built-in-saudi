// Starting points that show what the editor can do, in the reader's language.
import type { WorkbookData, SheetData, Cell } from './engine/model'
import type { Template } from '../../components/office/OfficeApp'
import { XL_STR } from './strings'

function sheet(name: string, rows: (string | [string, Cell['fmt']])[][], extra: Partial<SheetData> = {}): SheetData {
  const cells: SheetData['cells'] = {}
  rows.forEach((row, r) => row.forEach((v, c) => {
    const [input, fmt] = Array.isArray(v) ? v : [v, undefined]
    if (input !== '' || fmt) cells[`${r},${c}`] = fmt ? { input, fmt } : { input }
  }))
  return { name, cells, rows: Math.max(100, rows.length + 20), cols: 26, ...extra }
}

const H = { bold: true, bg: '#0b6e4f', color: '#ffffff' } as const
const SAR = { numFmt: 'currency', currency: 'SAR', decimals: 2 } as const

export function excelTemplates(locale: 'en' | 'ar'): Template<WorkbookData>[] {
  const s = XL_STR[locale]
  const ar = locale === 'ar'
  const t = (en: string, a: string) => (ar ? a : en)
  return [
    {
      id: 'budget',
      label: s.templates.budget,
      make: () => ({
        sheets: [sheet(t('Budget', 'الميزانية'), [
          [[t('Category', 'البند'), H], [t('Planned', 'المخطط'), H], [t('Actual', 'الفعلي'), H], [t('Difference', 'الفرق'), H]],
          [t('Rent', 'الإيجار'), ['4500', SAR], ['4500', SAR], ['=B2-C2', SAR]],
          [t('Groceries', 'البقالة'), ['1800', SAR], ['2075', SAR], ['=B3-C3', SAR]],
          [t('Transport', 'المواصلات'), ['900', SAR], ['640', SAR], ['=B4-C4', SAR]],
          [t('Utilities', 'الخدمات'), ['650', SAR], ['702', SAR], ['=B5-C5', SAR]],
          [t('Savings', 'الادخار'), ['2000', SAR], ['2000', SAR], ['=B6-C6', SAR]],
          [t('Sadaqah', 'الصدقة'), ['300', SAR], ['450', SAR], ['=B7-C7', SAR]],
          [[t('Total', 'المجموع'), { bold: true }], ['=SUM(B2:B7)', { ...SAR, bold: true }], ['=SUM(C2:C7)', { ...SAR, bold: true }], ['=SUM(D2:D7)', { ...SAR, bold: true }]],
        ], {
          colWidths: { 0: 140, 1: 110, 2: 110, 3: 110 },
          freeze: { rows: 1, cols: 0 },
          conds: [{ op: '<', value: 0, bg: '#f8d7da' }],
          charts: [{ id: 'c1', kind: 'column', range: 'A1:C7', title: t('Planned vs actual', 'المخطط مقابل الفعلي'), anchor: { row: 9, col: 0 }, size: { w: 440, h: 260 } }],
          rtl: ar,
        })],
        names: [],
      }),
    },
    {
      id: 'invoice',
      label: s.templates.invoice,
      make: () => ({
        sheets: [sheet(t('Invoice', 'الفاتورة'), [
          [[t('INVOICE', 'فاتورة'), { bold: true, fontSize: 18 }]],
          [t('Invoice no.', 'رقم الفاتورة'), 'INV-0001'],
          [t('Date', 'التاريخ'), ['=TODAY()', { numFmt: 'date' }]],
          [],
          [[t('Item', 'الصنف'), H], [t('Qty', 'الكمية'), H], [t('Unit price', 'سعر الوحدة'), H], [t('Amount', 'المبلغ'), H]],
          [t('Consulting (hours)', 'استشارات (ساعة)'), '12', ['350', SAR], ['=B6*C6', SAR]],
          [t('Design', 'تصميم'), '1', ['2500', SAR], ['=B7*C7', SAR]],
          ['', '', ['', SAR], ['=B8*C8', SAR]],
          [],
          ['', '', t('Subtotal', 'المجموع الفرعي'), ['=SUM(D6:D8)', SAR]],
          ['', '', t('VAT 15%', 'ضريبة القيمة المضافة 15%'), ['=ROUND(D10*15%,2)', SAR]],
          ['', '', [t('Total', 'الإجمالي'), { bold: true }], ['=D10+D11', { ...SAR, bold: true }]],
        ], { colWidths: { 0: 200, 1: 70, 2: 170, 3: 120 }, rtl: ar })],
        names: [],
      }),
    },
    {
      id: 'schedule',
      label: s.templates.schedule,
      make: () => {
        // The week starts on Sunday here; a Monday-first grid splits the working week.
        const days = ar ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'] : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
        const times = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00']
        return {
          sheets: [sheet(t('Week', 'الأسبوع'), [
            [['', H], ...days.map((d) => [d, H] as [string, Cell['fmt']])],
            ...times.map((tm) => [[tm, { bold: true }] as [string, Cell['fmt']], '', '', '', '', '']),
          ], { colWidths: { 0: 70, 1: 120, 2: 120, 3: 120, 4: 120, 5: 120 }, freeze: { rows: 1, cols: 1 }, rtl: ar })],
          names: [],
        }
      },
    },
    {
      id: 'tracker',
      label: s.templates.tracker,
      make: () => {
        const status = ar ? ['لم يبدأ', 'قيد التنفيذ', 'منجز'] : ['Not started', 'In progress', 'Done']
        return {
          sheets: [sheet(t('Tasks', 'المهام'), [
            [[t('Task', 'المهمة'), H], [t('Owner', 'المسؤول'), H], [t('Due', 'الاستحقاق'), H], [t('Status', 'الحالة'), H], [t('Progress', 'الإنجاز'), H]],
            [t('Draft proposal', 'مسودة العرض'), t('Noura', 'نورة'), '2026-11-04', status[2], ['1', { numFmt: 'percent' }]],
            [t('Client review', 'مراجعة العميل'), t('Omar', 'عمر'), '2026-11-10', status[1], ['0.5', { numFmt: 'percent' }]],
            [t('Final delivery', 'التسليم النهائي'), t('Sara', 'سارة'), '2026-11-20', status[0], ['0', { numFmt: 'percent' }]],
          ], {
            colWidths: { 0: 180, 1: 110, 2: 110, 3: 120, 4: 100 },
            validations: [{ range: 'D2:D200', kind: 'list', list: status }],
            conds: [{ op: 'eqText', value: status[2], bg: '#d6e7c8' }],
            scales: [{ box: { r0: 1, c0: 4, r1: 199, c1: 4 }, kind: 'databar' }],
            autoFilter: 'A1:E4',
            freeze: { rows: 1, cols: 0 },
            rtl: ar,
          })],
          names: [],
        }
      },
    },
  ]
}
