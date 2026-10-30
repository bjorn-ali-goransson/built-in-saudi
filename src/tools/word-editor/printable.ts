// The document as printed pages: the exported HTML, laid out by the shared
// paginator with the page setup, the running header and footer, and the page
// numbers filled in per page.
import { office } from '../../lib/office/officeClient'
import { paginate, type Printable } from '../../components/office/print'
import type { WordData } from './model'
import { layoutTabs } from './tabLayout'

// The exported page's own spacing is a web page's; on paper it follows the editor's.
const PRINT_CSS = 'p{margin:0 0 6pt}li>p{margin:0 0 2pt}h1,h2,h3,h4,h5,h6{margin:12pt 0 6pt}'

export async function printable(data: WordData, title: string): Promise<Printable> {
  const html = await office<string>('html-write', { data, opts: { title } })
  const d = new DOMParser().parseFromString(html, 'text/html')
  const css = [...d.querySelectorAll('style')].map((s) => s.textContent || '').join('\n') + '\n' + PRINT_CSS
  return paginate({
    title, css, body: d.body.innerHTML, dir: data.rtl ? 'rtl' : 'ltr', lang: data.lang,
    page: data.page, header: data.header, footer: data.footer, prepare: layoutTabs,
  })
}
