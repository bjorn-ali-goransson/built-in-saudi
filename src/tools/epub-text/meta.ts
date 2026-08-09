import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { BookmarkIcon } from '../../components/icons'

export const epubTextTool: Tool = {
  id: 'epub-text',
  name: 'EPUB to Text',
  nameAr: 'كتاب EPUB إلى نص',
  tagline: 'Get the text out of an ebook you own.',
  description:
    'Open an EPUB and take its text out — the whole book or one chapter at a time, as plain text or real Markdown that keeps its headings, lists, quotes and links — along with its title, authors, publisher and ISBN. Chapters come out in the order the book says to read them, not the order the files happen to be named. Read in your browser; the file is never uploaded.',
  category: 'Converters',
  keywords: [
    'epub', 'ebook', 'book', 'text', 'extract', 'convert', 'markdown', 'chapters', 'metadata', 'isbn', 'reader',
    'كتاب', 'إلكتروني', 'نص', 'استخراج', 'تحويل', 'فصول', 'ماركداون',
  ],
  status: 'stable',
  Icon: BookmarkIcon,
  component: lazyTool(() => import('./EpubTextTool')),
  ar: {
    name: 'كتاب EPUB إلى نص',
    tagline: 'استخرج نص كتاب تملكه.',
    description:
      'افتح ملف EPUB واستخرج نصّه — الكتاب كله أو فصلًا فصلًا، نصًّا عاديًا أو ماركداون حقيقية تحفظ العناوين والقوائم والاقتباسات والروابط — مع عنوانه ومؤلفيه وناشره ورقمه الدولي. وتخرج الفصول بالترتيب الذي يقول الكتاب أن يُقرأ به، لا بترتيب أسماء الملفات. تجري القراءة في متصفحك؛ ولا يُرفع الملف أبدًا.',
  },
}
