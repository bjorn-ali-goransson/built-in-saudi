import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { MarkdownIcon } from '../../components/icons'

export const pasteToMarkdownTool: Tool = {
  id: 'paste-to-markdown',
  name: 'HTML to Markdown',
  nameAr: 'لصق ماركداون',
  tagline: 'Word, web or WordPad → clean Markdown',
  description:
    'Paste formatted text — from a Word document, a web page, WordPad or an email — and get clean Markdown back. Line breaks, bold and italics, links, headings, lists, quotes, code blocks and tables are all preserved. Copy or share the result. Nothing is uploaded; the conversion happens entirely in your browser.',
  category: 'Text',
  keywords: ['markdown', 'html to markdown', 'rich text', 'paste', 'paste markdown', 'paste to markdown', 'paste rich text', 'convert', 'md', 'formatting', 'ماركداون', 'لصق', 'لصق ماركداون', 'تحويل', 'نص منسق', 'نص منسّق'],
  inverse: 'markdown-html',
  status: 'stable',
  Icon: MarkdownIcon,
  component: lazyTool(() => import('./PasteToMarkdownTool')),
  ar: {
    name: 'HTML إلى ماركداون',
    tagline: 'وورد أو ويب أو WordPad ← ماركداون نظيف',
    description:
      'الصق نصًا منسّقًا — من مستند وورد أو صفحة ويب أو WordPad أو بريد — واحصل على ماركداون نظيف. تُحفظ فواصل الأسطر والخط العريض والمائل والروابط والعناوين والقوائم والاقتباسات وكتل الشيفرة والجداول. انسخ الناتج أو شاركه. لا يُرفع شيء؛ التحويل يتم بالكامل داخل متصفحك.',
  },
}
