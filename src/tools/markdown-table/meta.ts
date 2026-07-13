import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TableIcon } from '../../components/icons'

export const markdownTableTool: Tool = {
  id: 'markdown-table',
  name: 'Markdown Table Generator',
  tagline: 'Turn CSV or TSV into a Markdown table.',
  description:
    'Paste comma- or tab-separated data (copied straight from a spreadsheet works) and get a neatly padded GitHub-flavoured Markdown table, with a choice of column alignment. Runs entirely in your browser.',
  category: 'Developer',
  keywords: ['markdown', 'table', 'csv', 'tsv', 'github', 'gfm', 'spreadsheet', 'جدول', 'ماركداون'],
  status: 'stable',
  Icon: TableIcon,
  component: lazyTool(() => import('./MarkdownTableTool')),
  ar: {
    name: 'مولّد جداول Markdown',
    tagline: 'حوّل CSV أو TSV إلى جدول Markdown.',
    description:
      'الصق بياناتٍ مفصولة بفواصل أو بعلامات جدولة (النسخ المباشر من جدول بيانات يعمل) لتحصل على جدول Markdown مرتّب بنمط GitHub، مع خيار محاذاة الأعمدة. يعمل بالكامل في متصفحك.',
  },
}
