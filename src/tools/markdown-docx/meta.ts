import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { FileIcon } from '../../components/icons'

export const markdownDocxTool: Tool = {
  id: 'markdown-docx',
  name: 'Markdown to Word',
  nameAr: 'ماركداون إلى وورد',
  tagline: 'A real .docx, written in your browser.',
  description:
    'Turn Markdown into a real Word document — headings, bold and italic, bulleted and numbered lists, tables, blockquotes, code blocks and dividers all arrive as Word formatting rather than as asterisks and pipes. The file is built in your browser and never uploaded, which is what you want when the document is a contract, a report or notes about a client.',
  category: 'Converters',
  keywords: [
    'markdown', 'md', 'word', 'docx', 'doc', 'convert', 'export', 'document',
    'markdown to word', 'md to docx', 'office', 'writer',
    'ماركداون', 'وورد', 'مستند', 'تحويل', 'تصدير', 'ملف وورد',
  ],
  status: 'stable',
  Icon: FileIcon,
  component: lazyTool(() => import('./MarkdownDocxTool')),
  ar: {
    name: 'ماركداون إلى وورد',
    tagline: 'ملف ‎.docx‎ حقيقي يُكتب في متصفحك.',
    description:
      'حوّل ماركداون إلى مستند وورد حقيقي — فتصل العناوين والخط العريض والمائل والقوائم المرقّمة والنقطية والجداول والاقتباسات وكتل الشيفرة والفواصل تنسيقًا في وورد، لا نجومًا وخطوطًا رأسية في النص. يُبنى الملف في متصفحك ولا يُرفع أبدًا، وهو ما تريده حين يكون المستند عقدًا أو تقريرًا أو ملاحظات عن عميل.',
  },
}
