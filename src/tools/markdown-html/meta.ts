import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CodeIcon } from '../../components/icons'

export const markdownHtmlTool: Tool = {
  id: 'markdown-html',
  name: 'Markdown to HTML',
  tagline: 'A fragment to paste, or a standalone file to open.',
  description:
    'Turn Markdown into HTML — either a fragment for a CMS or a standalone file with its own stylesheet, with heading anchors and both dir and lang set for Arabic. Raw HTML is escaped rather than passed through, so text from somebody else cannot bring a script with it. Runs entirely in your browser.',
  category: 'Converters',
  keywords: [
    'markdown to html', 'md to html', 'markdown converter', 'markdown preview',
    'render markdown', 'html', 'markdown', 'md', 'readme to html', 'convert markdown',
    'ماركداون إلى html', 'تحويل ماركداون', 'معاينة ماركداون', 'ماركداون',
  ],
  inverse: 'paste-to-markdown',
  status: 'stable',
  Icon: CodeIcon,
  component: lazyTool(() => import('./MarkdownHtmlTool')),
  ar: {
    name: 'ماركداون إلى HTML',
    tagline: 'مقطع تلصقه، أو ملف مستقل تفتحه.',
    description:
      'حوّل ماركداون إلى HTML — مقطعًا لنظام إدارة محتوى أو ملفًا مستقلًا بتنسيقه الخاص، مع معرّفات للعناوين وضبط dir وlang معًا للعربية. وتُهرَّب الوسوم الخام بدل تمريرها، فلا يأتي نصّ غيرك ومعه شيفرة. يعمل بالكامل داخل متصفحك.',
  },
}
