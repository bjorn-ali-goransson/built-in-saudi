"""Set our round-tripped office files against the originals, through software we did not write.

    python3 -I evals/office/compare.py <out-dir-of-roundtrip.ts> [--jobs 4]

For every <id>.orig / .plain / .ours triple roundtrip.ts left behind:
  1. LibreOffice renders each to PDF, each conversion with its OWN profile (two
     on one profile fail, and which two overlap depends on timing).
  2. TEXT: pdftotext of the original against ours. Recall is the share of the
     original's words that are still there, counted per word; the edit marker
     must be in the EDITED export. Text is compared on the rendered PDF, so a
     word our reader keeps and our writer hides (white on white, off the page,
     in a part nobody reads) still counts as lost.
  3. PAGES and PIXELS: page counts, and per page a mean absolute difference of
     the unedited export's rendering against the original's, at 40dpi greyscale
     — low enough that anti-aliasing and font hinting do not dominate, high
     enough that a missing picture, a lost table border or a reflowed page shows.
  4. The python readers (python-docx, openpyxl, python-pptx) must OPEN the
     edited export: a file LibreOffice repairs silently is still a file Word
     calls corrupt.
Writes compare.json and prints the worst first. Measures; does not judge.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageChops, ImageStat

EDIT = 'ROUNDTRIPEDITMARKER'


def to_pdf(path, outdir):
    prof = tempfile.mkdtemp(prefix='lo-prof-')
    t = time.time()
    subprocess.run(['soffice', f'-env:UserInstallation=file://{prof}', '--headless', '--convert-to', 'pdf', '--outdir', outdir, path],
                   capture_output=True, timeout=300)
    pdf = os.path.join(outdir, os.path.splitext(os.path.basename(path))[0] + '.pdf')
    return (pdf if os.path.exists(pdf) else None), round(time.time() - t, 1)


def words(pdf):
    txt = subprocess.run(['pdftotext', '-q', pdf, '-'], capture_output=True).stdout.decode('utf8', 'replace')
    return Counter(w for w in re.split(r'[\s‌‍‎‏]+', txt) if w)


def pages(pdf, prefix):
    subprocess.run(['pdftoppm', '-q', '-r', '40', '-gray', '-png', pdf, prefix], capture_output=True)
    d = os.path.dirname(prefix)
    b = os.path.basename(prefix)
    return [os.path.join(d, f) for f in sorted(os.listdir(d), key=lambda f: int(re.findall(r'(\d+)\.png$', f)[0]) if re.findall(r'(\d+)\.png$', f) else 0) if f.startswith(b + '-') and f.endswith('.png')]


def diff(a, b):
    ia, ib = Image.open(a).convert('L'), Image.open(b).convert('L')
    if ia.size != ib.size:
        ib = ib.resize(ia.size)
    return round(ImageStat.Stat(ImageChops.difference(ia, ib)).mean[0], 2)


def opens(path, kind):
    code = {'docx': 'import docx,sys; docx.Document(sys.argv[1])', 'xlsx': 'import openpyxl,sys; openpyxl.load_workbook(sys.argv[1])', 'pptx': 'import pptx,sys; pptx.Presentation(sys.argv[1])'}[kind]
    r = subprocess.run([sys.executable, '-I', '-c', code, path], capture_output=True, timeout=120)
    return r.returncode == 0, r.stderr.decode('utf8', 'replace').strip().splitlines()[-1:] if r.returncode else []


def one(out, rid, kind):
    work = tempfile.mkdtemp(prefix='cmp-')
    row = {'id': rid, 'kind': kind}
    pdfs = {}
    for v in ('orig', 'plain', 'ours'):
        pdf, secs = to_pdf(os.path.join(out, f'{rid}.{v}.{kind}'), work)
        pdfs[v] = pdf
        row[f'{v}Secs'] = secs
    if not pdfs['orig']:
        row['error'] = 'LibreOffice could not render the ORIGINAL'
        return row
    if not pdfs['plain'] or not pdfs['ours']:
        row['error'] = 'LibreOffice could not render OUR export'
        return row
    wo, wp, we = words(pdfs['orig']), words(pdfs['plain']), words(pdfs['ours'])
    lost = wo - wp
    total = sum(wo.values()) or 1
    row['recall'] = round(1 - sum(lost.values()) / total, 4)
    row['lost'] = [w for w, _ in lost.most_common(25)]
    row['extra'] = [w for w, _ in (wp - wo).most_common(15)]
    row['editRendered'] = we[EDIT] > 0
    po, pp = pages(pdfs['orig'], os.path.join(work, 'o')), pages(pdfs['plain'], os.path.join(work, 'p'))
    row['pages'] = [len(po), len(pp)]
    ds = [diff(a, b) for a, b in zip(po, pp)]
    row['pixel'] = {'mean': round(sum(ds) / len(ds), 2) if ds else None, 'worst': max(ds) if ds else None, 'worstPage': (ds.index(max(ds)) + 1) if ds else None}
    ok, err = opens(os.path.join(out, f'{rid}.ours.{kind}'), kind)
    row['opensInPython'] = ok
    if err:
        row['pythonError'] = err
    return row


def main():
    out = sys.argv[1]
    jobs = int(sys.argv[sys.argv.index('--jobs') + 1]) if '--jobs' in sys.argv else 4
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    items = []
    for f in sorted(os.listdir(out)):
        m = re.match(r'(.+)\.orig\.(docx|xlsx|pptx)$', f)
        if m and (not only or only in m.group(1)):
            items.append((m.group(1), m.group(2)))
    with ThreadPoolExecutor(jobs) as ex:
        rows = list(ex.map(lambda it: one(out, *it), items))
    rows.sort(key=lambda r: (r.get('error') is None, r.get('recall', 0), -(r.get('pixel') or {}).get('mean', 0) if r.get('pixel') and r['pixel']['mean'] is not None else 0))
    json.dump(rows, open(os.path.join(out, 'compare.json'), 'w'), ensure_ascii=False, indent=1)
    for r in rows:
        if r.get('error'):
            print(f"{r['kind']} ERROR {r['error']}  {r['id']}")
            continue
        px = r['pixel']
        print(f"{r['kind']} recall {r['recall']:.3f} pages {r['pages'][0]:>3}->{r['pages'][1]:<3} px mean {px['mean']!s:>5} worst {px['worst']!s:>5}@p{px['worstPage']}  edit {'ok' if r['editRendered'] else 'MISSING'}  py {'ok' if r['opensInPython'] else 'FAIL'}  {r['id'][:40]}  lost {' '.join(r['lost'][:8])}")


if __name__ == '__main__':
    main()
