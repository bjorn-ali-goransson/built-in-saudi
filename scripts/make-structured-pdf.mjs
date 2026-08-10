// Build `e2e/fixtures/structured.pdf` — run once, the output is committed.
//
// `pdf-to-word` claims to recover STRUCTURE from a PDF, so its fixture has to
// have some: a large title, a medium heading, a wholly bold line at body size,
// a paragraph whose sentence wraps across three lines, and a bulleted and a
// numbered list. A fixture of uniform 12pt paragraphs would let the tool pass
// while inferring nothing at all, which is the vacuous-green failure this repo
// keeps paying for.
//
//   node scripts/make-structured-pdf.mjs

import { writeFileSync } from 'node:fs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const doc = await PDFDocument.create()
const page = doc.addPage([595, 842]) // A4
const regular = await doc.embedFont(StandardFonts.Helvetica)
const bold = await doc.embedFont(StandardFonts.HelveticaBold)

let y = 780
const line = (text, { size = 11, font = regular, gap = 6 } = {}) => {
  page.drawText(text, { x: 56, y, size, font, color: rgb(0.1, 0.1, 0.1) })
  y -= size + gap
}

// A title, well above body size — this must come back as heading level 1.
line('Quarterly Operations Report', { size: 24, font: bold, gap: 14 })

// A section heading, clearly above body but below the title: level 2.
line('Summary of the quarter', { size: 16, font: bold, gap: 10 })

// A paragraph whose sentence WRAPS. Each of these is a separate PDF line and
// they must come back as ONE paragraph — joining only on a blank gap gives one
// paragraph per line, which is the most obvious way a conversion is unusable.
line('Revenue rose across every region we operate in during the quarter, with the')
line('strongest growth recorded in the eastern province, where two new suppliers')
line('came online ahead of the schedule agreed in March.')

y -= 8
// A wholly bold line at BODY size — the fourth-level heading every report uses
// and no size test can see.
line('Regional detail', { font: bold, gap: 10 })

line('• Riyadh: 1,204 units')
line('• Jeddah: 880 units')
line('• Dammam: 356 units')

y -= 8
line('Next steps', { size: 16, font: bold, gap: 10 })
line('1. Close the books for the quarter.')
line('2. Circulate the summary to the board.')

// A run of BOLD inside an otherwise plain line, drawn as two runs at the same
// baseline — this is what a formatting boundary looks like in a real PDF, and
// it must survive as <w:b/> rather than being flattened.
page.drawText('Prepared by ', { x: 56, y, size: 11, font: regular })
page.drawText('Operations', { x: 56 + regular.widthOfTextAtSize('Prepared by ', 11), y, size: 11, font: bold })

writeFileSync('e2e/fixtures/structured.pdf', await doc.save())
console.log('wrote e2e/fixtures/structured.pdf')
