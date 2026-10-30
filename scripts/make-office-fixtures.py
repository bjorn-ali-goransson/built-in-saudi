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


def ods_libreoffice():
    # A real .ods from LibreOffice: merged cells, a cross-sheet formula, a date.
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = 'Data'
    ws['A1'] = 'Name'; ws['B1'] = 'Amount'
    ws['A2'] = 'نورة'; ws['B2'] = 1500
    ws['A3'] = 'Omar'; ws['B3'] = 250.75
    ws['B4'] = '=SUM(B2:B3)'
    ws['A6'] = datetime.date(2026, 9, 7)
    ws.merge_cells('A8:C8'); ws['A8'] = 'Merged'
    ws['C2'] = '0501234567'
    s2 = wb.create_sheet('Other Sheet')
    s2['A1'] = '=Data!B4*2'
    s2['A2'] = '=IF(Data!B2>1000;"big";"small")'.replace(';', ',')
    with tempfile.TemporaryDirectory() as t:
        src = os.path.join(t, 'ods-source.xlsx')
        wb.save(src)
        soffice(src, 'ods', t)
        shutil.copy(os.path.join(t, 'ods-source.ods'), os.path.join(XL, 'libreoffice.ods'))


def docx_python():
    # python-docx: built-in heading and list styles, a merged table, a picture,
    # an Arabic right-to-left paragraph, a page break and direct formatting.
    import docx
    from docx.shared import Pt, RGBColor, Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    d = docx.Document()
    d.core_properties.title = 'Quarterly report'
    d.add_heading('Quarterly report', level=1)
    p = d.add_paragraph('Revenue rose by ')
    r = p.add_run('twelve percent'); r.bold = True
    p.add_run(' in ')
    r = p.add_run('Riyadh'); r.italic = True; r.font.color.rgb = RGBColor(0xC0, 0x00, 0x00)
    p.add_run(' and ')
    r = p.add_run('Jeddah'); r.underline = True; r.font.size = Pt(14)
    p.add_run('.')
    d.add_heading('Highlights', level=2)
    for t in ['First point', 'Second point']:
        d.add_paragraph(t, style='List Bullet')
    for t in ['Step one', 'Step two', 'Step three']:
        d.add_paragraph(t, style='List Number')
    c = d.add_paragraph('Centred line'); c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    ar = d.add_paragraph('نمت الإيرادات بنسبة اثني عشر بالمئة')
    pPr = ar._p.get_or_add_pPr(); bidi = OxmlElement('w:bidi'); pPr.append(bidi)
    for run in ar.runs:
        rpr = run._r.get_or_add_rPr(); rtl = OxmlElement('w:rtl'); rpr.append(rtl)
    t = d.add_table(rows=3, cols=3); t.style = 'Table Grid'
    for i in range(3):
        for j in range(3):
            t.cell(i, j).text = f'r{i}c{j}'
    t.cell(0, 0).merge(t.cell(0, 1))
    t.cell(1, 2).merge(t.cell(2, 2))
    d.add_paragraph().add_run().add_picture(io.BytesIO(png(8, 6)), width=Inches(1))
    br = d.add_paragraph().add_run(); br.add_break(WD_BREAK.PAGE)
    d.add_paragraph('After the break')
    sec = d.sections[0]
    sec.header.paragraphs[0].text = 'Confidential'
    d.save(os.path.join(WD, 'python-docx.docx'))


LO_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>LibreOffice fixture</title></head><body>
<h1>Annual plan</h1>
<p>A paragraph with <b>bold</b>, <i>italic</i>, <a href="https://built-in-saudi.com">a link</a> and a note<a class="sdfootnoteanc" name="sdfootnote1anc" href="#sdfootnote1sym"><sup>1</sup></a>.</p>
<ol start="3"><li>Third</li><li>Fourth<ul><li>Nested bullet</li></ul></li></ol>
<p>Between the lists.</p>
<ol><li>Again one</li></ol>
<table border="1"><tr><td rowspan="2">Tall</td><td>B1</td></tr><tr><td>B2</td></tr><tr><td colspan="2">Wide</td></tr></table>
<p dir="rtl">فقرة عربية من اليمين إلى اليسار.</p>
<div id="sdfootnote1"><p><a class="sdfootnotesym" name="sdfootnote1sym" href="#sdfootnote1anc">1</a>The footnote text.</p></div>
</body></html>"""


def word_libreoffice():
    with tempfile.TemporaryDirectory() as t:
        src = os.path.join(t, 'lo-source.html')
        open(src, 'w', encoding='utf-8').write(LO_HTML)
        for fmt, filt, name in (('docx', 'docx:MS Word 2007 XML', 'libreoffice.docx'), ('odt', 'odt:writer8', 'libreoffice.odt')):
            subprocess.run(['soffice', '--headless', '--infilter=HTML (StarWriter)', '--convert-to', filt, '--outdir', t, src], check=True, capture_output=True, timeout=120)
            shutil.copy(os.path.join(t, 'lo-source.' + fmt), os.path.join(WD, name))


def word_floating():
    """A picture floated right and a two-paragraph text box floated left, as
    LibreOffice writes them: DrawingML in an mc:Choice with a VML Fallback in
    .docx, and graphic styles in .odt. floating-vml.docx keeps only the VML
    branch, which is how Word 2007 wrote the same thing."""
    import base64, re, zipfile
    b = base64.b64encode(png(40, 30)).decode()
    fodt = f'''<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.text">
<office:automatic-styles>
<style:style style:name="frR" style:family="graphic"><style:graphic-properties style:wrap="parallel" style:horizontal-pos="right" style:horizontal-rel="paragraph" style:vertical-pos="top" style:vertical-rel="paragraph" fo:margin-left="0.2cm"/></style:style>
<style:style style:name="frL" style:family="graphic"><style:graphic-properties style:wrap="parallel" style:horizontal-pos="left" style:horizontal-rel="paragraph" style:vertical-pos="top" style:vertical-rel="paragraph" fo:background-color="#fff2cc" fo:border="0.5pt solid #000000" fo:padding="0.1cm"/></style:style>
</office:automatic-styles>
<office:body><office:text>
<text:p>Before the picture.</text:p>
<text:p><draw:frame draw:style-name="frR" draw:name="Logo" text:anchor-type="paragraph" svg:width="3cm" svg:height="2.25cm"><draw:image><office:binary-data>{b}</office:binary-data></draw:image><svg:title>Company logo</svg:title></draw:frame>This paragraph wraps around a picture floated to the right of the text column, the way a newsletter places a logo.</text:p>
<text:p><draw:frame draw:style-name="frL" draw:name="Box" text:anchor-type="paragraph" svg:width="5cm"><draw:text-box fo:min-height="2cm"><text:p>Key figure</text:p><text:p>Revenue rose twelve percent.</text:p></draw:text-box></draw:frame>This paragraph sits beside a text box floated to the left, a sidebar with two paragraphs of its own.</text:p>
<text:p>After everything.</text:p>
</office:text></office:body></office:document>'''
    with tempfile.TemporaryDirectory() as t:
        src = os.path.join(t, 'floating.fodt')
        open(src, 'w', encoding='utf-8').write(fodt)
        for filt, ext in (('docx:MS Word 2007 XML', 'docx'), ('odt', 'odt')):
            subprocess.run(['soffice', '--headless', '--convert-to', filt, '--outdir', t, src], check=True, capture_output=True, timeout=120)
            shutil.copy(os.path.join(t, 'floating.' + ext), os.path.join(WD, 'floating.' + ext))
    zi = zipfile.ZipFile(os.path.join(WD, 'floating.docx'))
    with zipfile.ZipFile(os.path.join(WD, 'floating-vml.docx'), 'w', zipfile.ZIP_DEFLATED) as zo:
        for it in zi.infolist():
            d = zi.read(it.filename)
            if it.filename == 'word/document.xml':
                d = re.sub(r'<mc:AlternateContent><mc:Choice Requires="wps">.*?</mc:Choice><mc:Fallback>(.*?)</mc:Fallback></mc:AlternateContent>', r'\1', d.decode(), flags=re.S).encode()
            zo.writestr(it, d)


def xlsx_protected_rich():
    """Rich text in a cell, a password-protected sheet with one unlocked cell,
    workbook structure protection, a styled table and an autofilter with real
    criteria — every item the spreadsheet importer used to list as lost."""
    from openpyxl import Workbook
    from openpyxl.cell.rich_text import CellRichText, TextBlock
    from openpyxl.cell.text import InlineFont
    from openpyxl.styles import Protection
    from openpyxl.worksheet.table import Table, TableStyleInfo
    from openpyxl.workbook.protection import WorkbookProtection
    wb = Workbook()
    ws = wb.active
    ws.title = 'Plan'
    ws['A1'] = CellRichText(['Status: ', TextBlock(InlineFont(b=True, color='FFC00000'), 'late'), ' by two days'])
    ws['B1'] = 'unlocked here'
    ws['B1'].protection = Protection(locked=False)
    ws.protection.sheet = True
    ws.protection.password = 'test'
    ws.protection.insertRows = False
    rows = [['Region', 'Q1', 'Q2'], ['Riyadh', 10, 12], ['Jeddah', 8, 9], ['Dammam', 7, 6]]
    for i, r in enumerate(rows):
        for j, v in enumerate(r):
            ws.cell(row=4 + i, column=1 + j, value=v)
    t = Table(displayName='Sales', ref='A4:C7')
    t.tableStyleInfo = TableStyleInfo(name='TableStyleMedium9', showRowStripes=True)
    ws.add_table(t)
    f = wb.create_sheet('Filtered')
    for i, r in enumerate([['City', 'Kind'], ['Riyadh', 'a'], ['Jeddah', 'b'], ['Dammam', 'a']]):
        for j, v in enumerate(r):
            f.cell(row=1 + i, column=1 + j, value=v)
    f.auto_filter.ref = 'A1:B4'
    f.auto_filter.add_filter_column(1, ['a'])
    wb.security = WorkbookProtection(lockStructure=True)
    wb.save(os.path.join(XL, 'protected-rich.xlsx'))


def pptx_python():
    """A deck from python-pptx's default template: real masters, layouts, theme and placeholders."""
    from pptx import Presentation
    from pptx.util import Pt, Emu, Inches
    from pptx.dml.color import RGBColor
    from pptx.enum.shapes import MSO_SHAPE
    from pptx.enum.text import PP_ALIGN
    from pptx.chart.data import CategoryChartData
    from pptx.enum.chart import XL_CHART_TYPE
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
    prs.core_properties.title = 'Product launch'
    s1 = prs.slides.add_slide(prs.slide_layouts[0])
    s1.shapes.title.text = 'Product launch'
    s1.placeholders[1].text = 'Riyadh, 2026'
    s1.notes_slide.notes_text_frame.text = 'Welcome everyone.'
    s2 = prs.slides.add_slide(prs.slide_layouts[1])
    s2.shapes.title.text = 'Agenda'
    tf = s2.placeholders[1].text_frame
    tf.text = 'Where we are'
    p = tf.add_paragraph(); p.text = 'The numbers'; p.level = 1
    p = tf.add_paragraph(); p.text = 'Next steps'
    r = p.runs[0]; r.font.bold = True; r.font.color.rgb = RGBColor(0xC0, 0x00, 0x00)
    p = tf.add_paragraph(); r = p.add_run(); r.text = 'Our site'; r.hyperlink.address = 'https://example.com/'
    s3 = prs.slides.add_slide(prs.slide_layouts[5])
    s3.shapes.title.text = 'Shapes and a table'
    box = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.5), Inches(1.8), Inches(3), Inches(1.5))
    box.fill.solid(); box.fill.fore_color.rgb = RGBColor(0x0B, 0x6E, 0x4F)
    box.line.color.rgb = RGBColor(0x00, 0x00, 0x00); box.line.width = Pt(2)
    box.text_frame.text = 'Rounded'
    box.rotation = 15
    arr = s3.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(4), Inches(2), Inches(2), Inches(1))
    tb = s3.shapes.add_textbox(Inches(0.5), Inches(4), Inches(5), Inches(1))
    tb.text_frame.text = 'مرحبا بكم في الرياض'
    tb.text_frame.paragraphs[0].alignment = PP_ALIGN.RIGHT
    grp = s3.shapes.add_group_shape()
    grp.shapes.add_shape(MSO_SHAPE.OVAL, Inches(7), Inches(5.5), Inches(1), Inches(1))
    grp.shapes.add_shape(MSO_SHAPE.OVAL, Inches(8.5), Inches(5.5), Inches(1), Inches(1))
    rows, cols = 3, 3
    tbl = s3.shapes.add_table(rows, cols, Inches(7), Inches(1.8), Inches(5), Inches(1.5)).table
    for c, t in enumerate(['Region', 'Q1', 'Q2']):
        tbl.cell(0, c).text = t
    tbl.cell(1, 0).text = 'Riyadh'; tbl.cell(1, 1).text = '120'; tbl.cell(1, 2).text = '135'
    tbl.cell(2, 0).merge(tbl.cell(2, 1)); tbl.cell(2, 0).text = 'Merged'; tbl.cell(2, 2).text = '9'
    s4 = prs.slides.add_slide(prs.slide_layouts[6])
    import io as _io
    s4.shapes.add_picture(_io.BytesIO(png(8, 6, (200, 30, 30))), Inches(1), Inches(1), Inches(4), Inches(3))
    cd = CategoryChartData(); cd.categories = ['A', 'B']; cd.add_series('S', (1, 2))
    s4.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(6), Inches(1), Inches(5), Inches(4), cd)
    s5 = prs.slides.add_slide(prs.slide_layouts[1])
    s5.shapes.title.text = 'Hidden slide'
    s5._element.set('show', '0')
    prs.save(os.path.join(PP, 'python-pptx.pptx'))


def pptx_libreoffice():
    """The same deck written back by LibreOffice Impress: a different producer's idea of every part."""
    with tempfile.TemporaryDirectory() as t:
        src = os.path.join(t, 'lo.pptx')
        shutil.copy(os.path.join(PP, 'python-pptx.pptx'), src)
        out = os.path.join(t, 'out')
        os.makedirs(out)
        subprocess.run(['soffice', '--headless', '--convert-to', 'odp', '--outdir', out, src], check=True, capture_output=True, timeout=180)
        odp = os.path.join(out, 'lo.odp')
        shutil.copy(odp, os.path.join(PP, 'libreoffice.odp'))
        out2 = os.path.join(t, 'out2')
        os.makedirs(out2)
        subprocess.run(['soffice', '--headless', '--convert-to', 'pptx:Impress MS PowerPoint 2007 XML', '--outdir', out2, odp], check=True, capture_output=True, timeout=180)
        shutil.copy(os.path.join(out2, 'lo.pptx'), os.path.join(PP, 'libreoffice.pptx'))


def main():
    docx_python()
    pptx_python()
    try:
        pptx_libreoffice()
    except Exception as e:  # noqa
        print('LibreOffice slides fixtures skipped:', e, file=sys.stderr)
    try:
        word_libreoffice()
        word_floating()
    except Exception as e:  # noqa
        print('LibreOffice word fixtures skipped:', e, file=sys.stderr)
    try:
        ods_libreoffice()
    except Exception as e:  # noqa
        print('ODS fixture skipped:', e, file=sys.stderr)
    xlsx_excel_shared()
    xlsx_openpyxl()
    xlsx_xlsxwriter()
    xlsx_1904()
    xlsx_protected_rich()
    try:
        xlsx_libreoffice_shared()
    except Exception as e:  # noqa
        print('LibreOffice fixture skipped:', e, file=sys.stderr)
    if len(sys.argv) > 1 and sys.argv[1] == '--all':
        import make_office_fixtures_docs  # noqa  (word/powerpoint fixtures live in their own section below)


if __name__ == '__main__':
    main()
    print('ok')
