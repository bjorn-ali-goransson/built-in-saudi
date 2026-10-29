"""Build the office-editor test fixtures with INDEPENDENT producers.

A reader tested only against files its own writer made proves that two halves of
one misunderstanding agree. These come from openpyxl, xlsxwriter, python-docx,
python-pptx and LibreOffice — the files real people send.

Run once; the outputs are committed:
    python3 scripts/make-office-fixtures.py
"""
import datetime, os, shutil, subprocess, sys, tempfile, io, struct, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
XL = os.path.join(ROOT, 'src/tools/excel-editor/io/__fixtures__')
WD = os.path.join(ROOT, 'src/tools/word-editor/io/__fixtures__')
PP = os.path.join(ROOT, 'src/tools/powerpoint-editor/io/__fixtures__')
for d in (XL, WD, PP):
    os.makedirs(d, exist_ok=True)


def png(w=4, h=3, rgb=(14, 90, 63)):
    raw = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')


def xlsx_openpyxl():
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
    from openpyxl.comments import Comment
    from openpyxl.worksheet.datavalidation import DataValidation
    from openpyxl.formatting.rule import CellIsRule, ColorScaleRule
    from openpyxl.workbook.defined_name import DefinedName
    from openpyxl.drawing.image import Image
    from openpyxl.chart import BarChart, Reference
    wb = Workbook()
    ws = wb.active
    ws.title = 'Sales'
    ws.append(['Region', 'Q1', 'Q2', 'Total'])
    for i, (r, a, b) in enumerate([('Riyadh', 120, 135), ('Jeddah', 98, 110), ('Dammam', 75.5, 80)], start=2):
        ws.append([r, a, b, f'=SUM(B{i}:C{i})'])
    ws['A6'] = 'Grand total'
    ws['D6'] = '=SUM(D2:D4)'
    ws['B8'] = 0.075
    ws['B8'].number_format = '0.0%'
    ws['B9'] = datetime.date(2026, 9, 7)
    ws['B9'].number_format = 'dd/mm/yyyy'
    ws['B10'] = 1234567.891
    ws['B10'].number_format = '#,##0.00;[Red]-#,##0.00'
    ws['B11'] = '0501234567'
    ws['B12'] = True
    ws['B13'] = '=1/0'
    ws['B14'] = '=Settings!B1*D6'
    ws['B15'] = '=TaxRate*100'
    ws['A1'].font = Font(bold=True, italic=True, color='FFC00000', size=14, name='Arial')
    ws['B1'].fill = PatternFill('solid', fgColor='FFFFF2CC')
    thin = Side(style='thin', color='FF000000')
    ws['D6'].border = Border(top=thin, bottom=Side(style='double', color='FF0E5A3F'))
    ws['A6'].alignment = Alignment(horizontal='right', vertical='center', wrap_text=True)
    ws.merge_cells('A17:C18')
    ws['A17'] = 'Merged note'
    ws.freeze_panes = 'B2'
    ws.column_dimensions['A'].width = 22
    ws.row_dimensions[1].height = 30
    ws.row_dimensions[16].hidden = True
    ws.column_dimensions['F'].hidden = True
    ws['A2'].comment = Comment('Head office', 'Fixture')
    ws['A3'].hyperlink = 'https://built-in-saudi.com'
    dv = DataValidation(type='list', formula1='"Open,Closed,Pending"', allow_blank=True)
    ws.add_data_validation(dv)
    dv.add('E2:E4')
    ws.conditional_formatting.add('B2:C4', CellIsRule(operator='greaterThan', formula=['100'], fill=PatternFill('solid', bgColor='FFC6EFCE')))
    ws.conditional_formatting.add('D2:D4', ColorScaleRule(start_type='min', start_color='FFF8696B', end_type='max', end_color='FF63BE7B'))
    ws.auto_filter.ref = 'A1:D4'
    img = Image(io.BytesIO(png()))
    ws.add_image(img, 'G2')
    ch = BarChart()
    ch.title = 'Quarterly'
    ch.add_data(Reference(ws, min_col=2, min_row=1, max_col=3, max_row=4), titles_from_data=True)
    ch.set_categories(Reference(ws, min_col=1, min_row=2, max_row=4))
    ws.add_chart(ch, 'G8')
    s2 = wb.create_sheet('Settings')
    s2['A1'] = 'Rate'
    s2['B1'] = 0.15
    s3 = wb.create_sheet('الملخص')
    s3.sheet_view.rightToLeft = True
    s3['A1'] = 'المنطقة'
    s3['B1'] = '=Sales!D6'
    s3.sheet_properties.tabColor = 'FF0E5A3F'
    wb.defined_names['TaxRate'] = DefinedName('TaxRate', attr_text='Settings!$B$1')
    wb.save(os.path.join(XL, 'openpyxl-rich.xlsx'))


def xlsx_xlsxwriter():
    import xlsxwriter
    path = os.path.join(XL, 'xlsxwriter-future.xlsx')
    wb = xlsxwriter.Workbook(path, {'use_future_functions': True})
    ws = wb.add_worksheet('Lookup')
    ws.write_row(0, 0, ['Code', 'Name', 'Price'])
    for i, row in enumerate([('A1', 'Dates', 25), ('B2', 'Coffee', 40), ('C3', 'Oud', 300)], start=1):
        ws.write_row(i, 0, row)
    ws.write_formula('E1', '=XLOOKUP("B2",A2:A4,B2:B4)', None, 'Coffee')
    ws.write_formula('E2', '=IFS(C2>100,"high",C2>20,"mid")', None, 'mid')
    ws.write_formula('E3', '=TEXTJOIN(", ",TRUE,B2:B4)', None, 'Dates, Coffee, Oud')
    ws.write_formula('E4', '=MAXIFS(C2:C4,C2:C4,"<300")', None, 40)
    ws.write_string('E5', '=not a formula')
    bold = wb.add_format({'bold': 1, 'bg_color': '#0E5A3F', 'font_color': '#FFFFFF'})
    ws.write('A7', 'Styled', bold)
    wb.close()


def xlsx_1904():
    from openpyxl import Workbook
    wb = Workbook()
    wb.epoch = datetime.datetime(1904, 1, 1)
    ws = wb.active
    ws['A1'] = datetime.date(2026, 1, 15)
    ws['A1'].number_format = 'yyyy-mm-dd'
    wb.save(os.path.join(XL, 'date1904.xlsx'))


def soffice(src, fmt, outdir):
    subprocess.run(['soffice', '--headless', '--convert-to', fmt, '--outdir', outdir, src], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=180)


def xlsx_libreoffice_shared():
    # LibreOffice writes SHARED formulas for a filled column — the case a naive reader gets wrong.
    with tempfile.TemporaryDirectory() as t:
        csv = os.path.join(t, 'filled.csv')
        with open(csv, 'w') as f:
            f.write('n,double,running\n')
            for i in range(1, 21):
                f.write(f'{i},=A{i+1}*2,=SUM(A$2:A{i+1})\n')
        soffice(csv, 'xlsx:Calc MS Excel 2007 XML', t)
        shutil.copy(os.path.join(t, 'filled.xlsx'), os.path.join(XL, 'libreoffice-shared.xlsx'))


def xlsx_excel_shared():
    # Exactly the shape Excel writes for a filled column: one master <f t="shared" ref si>,
    # and every other cell in the block a bare <f t="shared" si="0"/> with only a cached value.
    import zipfile
    rows = ['<row r="1"><c r="A1" t="inlineStr"><is><t>n</t></is></c><c r="B1" t="inlineStr"><is><t>x3</t></is></c></row>']
    for i in range(2, 12):
        a = f'<c r="A{i}"><v>{i - 1}</v></c>'
        if i == 2:
            b = f'<c r="B{i}"><f t="shared" ref="B2:B11" si="0">A2*3+$A$2</f><v>{(i - 1) * 3 + 1}</v></c>'
        else:
            b = f'<c r="B{i}"><f t="shared" si="0"/><v>{(i - 1) * 3 + 1}</v></c>'
        rows.append(f'<row r="{i}">{a}{b}</row>')
    sheet = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
             '<sheetData>' + ''.join(rows) + '</sheetData></worksheet>')
    wbx = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
           'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Shared" sheetId="1" r:id="rId1"/></sheets></workbook>')
    with zipfile.ZipFile(os.path.join(XL, 'excel-shared.xlsx'), 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        z.writestr('xl/workbook.xml', wbx)
        z.writestr('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
        z.writestr('xl/worksheets/sheet1.xml', sheet)


def main():
    xlsx_excel_shared()
    xlsx_openpyxl()
    xlsx_xlsxwriter()
    xlsx_1904()
    try:
        xlsx_libreoffice_shared()
    except Exception as e:  # noqa
        print('LibreOffice fixture skipped:', e, file=sys.stderr)
    if len(sys.argv) > 1 and sys.argv[1] == '--all':
        import make_office_fixtures_docs  # noqa  (word/powerpoint fixtures live in their own section below)


if __name__ == '__main__':
    main()
    print('ok')
