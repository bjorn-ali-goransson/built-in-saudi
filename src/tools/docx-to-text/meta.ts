import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { FileIcon } from '../../components/icons'

export const docxToTextTool: Tool = {
  id: 'docx-to-text',
  name: 'Word to Text',
  nameAr: 'وورد إلى نص',
  tagline: 'Get the words out of a .docx.',
  description:
    'Read a Word document as plain text, with the paragraphs where they were and the table columns still apart — ready to paste into anything, on a machine with no Word on it. Headers, footers and footnotes are kept separate rather than mixed into the body, because they repeat on every page. The file is read in your browser and never uploaded.',
  category: 'Text',
  keywords: [
    'docx', 'word', 'doc', 'to text', 'txt', 'extract', 'convert', 'open word', 'read docx', 'plain text',
    'وورد', 'ملف وورد', 'نص', 'استخراج', 'تحويل', 'فتح', 'نص عادي',
  ],
  status: 'stable',
  Icon: FileIcon,
  component: lazyTool(() => import('./DocxToTextTool')),
  ar: {
    name: 'وورد إلى نص',
    tagline: 'استخرج نص ملف وورد.',
    description:
      'اقرأ مستند وورد نصًا عاديًا، بفقراته في مواضعها وأعمدة جداوله متباعدة كما كانت — جاهزًا للصق في أي شيء، وعلى جهاز لا وورد فيه. وتُفصل الرؤوس والتذييلات والحواشي عن المتن بدل أن تختلط به، لأنها تتكرر في كل صفحة. ويُقرأ الملف في متصفحك ولا يُرفع أبدًا.',
  },
}
