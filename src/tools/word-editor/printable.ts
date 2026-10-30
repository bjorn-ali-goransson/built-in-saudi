// The document as printed pages: the exported HTML, laid out by the shared
// paginator with the page setup, the running header and footer, and the page
// numbers filled in per page.
import { office } from '../../lib/office/officeClient'
import { paginate, type Printable } from '../../components/office/print'
import type { WordData } from './model'
import { layoutTabs } from './tabLayout'
import { faceVars, lineFactor, facesIn, faceLineVars, varsCss } from './docFont'

// The exported page's own spacing is a web page's; on paper it follows the editor's.
const PRINT_CSS = 'p{margin:0 0 6pt}li>p{margin:0 0 2pt}h1,h2,h3,h4,h5,h6{margin:12pt 0 6pt}'

export async function printable(data: WordData, title: string): Promise<Printable> {
  const html = await office<string>('html-write', { data, opts: { title } })
  const d = new DOMParser().parseFromString(html, 'text/html')
  const css = [...d.querySelectorAll('style')].map((s) => s.textContent || '').join('\n') + '\n' + PRINT_CSS
  const stack = faceVars(data)['--wd-font']
  return paginate({
    title, css, body: d.body.innerHTML, dir: data.rtl ? 'rtl' : 'ltr', lang: data.lang,
    page: data.page, header: data.header, footer: data.footer,
    // The face's single line, measured IN the frame the pages are laid out and drawn in: multiples
    // are of it, and the frame has the system's faces, not the site's web fonts. Written into the
    // flow itself so every page that shows a slice of it carries the same value.
    prepare: (root) => {
      const style = root.ownerDocument.createElement('style')
      style.textContent = `:root{--wd-lh:${lineFactor(stack || getComputedStyle(root).fontFamily, root.ownerDocument)};${varsCss(faceLineVars(facesIn(data.doc), root.ownerDocument))}}`
      root.prepend(style)
      layoutTabs(root)
    },
    headerAt: data.page.headerAt ?? 12.5, footerAt: data.page.footerAt ?? 12.5,
    lineBreaks: true,
  })
}
