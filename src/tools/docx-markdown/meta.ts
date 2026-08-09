import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { FileIcon } from '../../components/icons'

export const docxMarkdownTool: Tool = {
  id: 'docx-markdown',
  name: 'Word to Markdown',
  nameAr: 'وورد إلى ماركداون',
  tagline: 'Keep the structure, not just the words.',
  description:
    'Turn a Word document into Markdown — headings, bold and italic, bulleted and numbered lists, tables, blockquotes and links all survive as Markdown rather than being flattened into prose. Read in your browser and never uploaded, which is what you want when the document is a contract or a draft. The other direction is here too.',
  category: 'Converters',
  keywords: [
    'word to markdown', 'docx to md', 'docx to markdown', 'word', 'docx', 'markdown',
    'md', 'convert', 'export', 'document', 'office',
    'وورد إلى ماركداون', 'ماركداون', 'وورد', 'مستند', 'تحويل', 'تصدير',
  ],
  status: 'stable',
  Icon: FileIcon,
  component: lazyTool(() => import('./DocxMarkdownTool')),
  ar: {
    name: 'وورد إلى ماركداون',
    tagline: 'احفظ البنية لا الكلمات وحدها.',
    description:
      'حوّل مستند وورد إلى ماركداون — فتبقى العناوين والخط العريض والمائل والقوائم المرقّمة والنقطية والجداول والاقتباسات والروابط ماركداون، بدل أن تُسطَّح إلى نصٍّ عادي. تجري القراءة في متصفحك ولا يُرفع المستند أبدًا، وهو ما تريده حين يكون عقدًا أو مسودة. والاتجاه الآخر متاح هنا أيضًا.',
  },
}
