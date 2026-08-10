import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { BookmarkIcon } from '../../components/icons'

export const markdownEpubTool: Tool = {
  id: 'markdown-epub',
  name: 'Markdown to EPUB',
  nameAr: 'ماركداون إلى كتاب EPUB',
  tagline: 'Turn your writing into an ebook.',
  description:
    'Turn Markdown into a real EPUB you can read on a Kindle, a phone or any e-reader — chapters split at your headings, a working table of contents, and headings, lists, tables, quotes and code all carried across. Arabic books are written right-to-left properly: the text direction AND the page-turn direction, which is the half most generators leave out. Built in your browser, so an unpublished manuscript is never uploaded to anybody.',
  category: 'Converters',
  keywords: [
    'epub', 'ebook', 'markdown', 'md', 'book', 'convert', 'export', 'kindle',
    'e-reader', 'publish', 'manuscript', 'markdown to epub', 'md to epub',
    'كتاب إلكتروني', 'ماركداون', 'تحويل', 'نشر', 'مخطوطة', 'قارئ', 'كتاب',
  ],
  inverse: 'epub-text',
  status: 'stable',
  Icon: BookmarkIcon,
  component: lazyTool(() => import('./MarkdownEpubTool')),
  ar: {
    name: 'ماركداون إلى كتاب EPUB',
    tagline: 'حوّل كتابتك إلى كتاب إلكتروني.',
    description:
      'حوّل ماركداون إلى كتاب EPUB حقيقي تقرؤه على الكيندل أو الجوال أو أي قارئ — تُقسَّم الفصول عند عناوينك، مع فهرس يعمل، وتنتقل العناوين والقوائم والجداول والاقتباسات والشيفرة كما هي. وتُكتب الكتب العربية من اليمين إلى اليسار كما ينبغي: اتجاه النص واتجاه تقليب الصفحات معًا، وهو النصف الذي تغفله معظم المولّدات. يُبنى في متصفحك، فلا تُرفع مخطوطة غير منشورة إلى أحد.',
  },
}
