import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { BinaryIcon } from '../../components/icons'

export const hexViewerTool: Tool = {
  id: 'hex-viewer',
  name: 'Hex Viewer',
  nameAr: 'عارض السداسي عشري',
  tagline: 'See what a file really is, byte by byte.',
  description:
    'Open any file and look at its actual bytes, with the printable characters alongside so embedded strings jump out. It reads the magic number to say what the file really is — and tells you when the extension and the contents disagree, which no file manager will. Search for text or a byte sequence, and jump to any offset. Nothing is uploaded.',
  category: 'Files',
  keywords: ['hex', 'hex editor', 'binary', 'file header', 'magic number', 'dump', 'سداسي عشري', 'ثنائي', 'ترويسة', 'ملف', 'فحص'],
  status: 'stable',
  Icon: BinaryIcon,
  component: lazyTool(() => import('./HexViewerTool')),
  ar: {
    name: 'عارض الملفات السداسي عشري',
    tagline: 'اعرف حقيقة الملف بايتًا بايتًا.',
    description:
      'افتح أي ملف واطّلع على بايتاته الفعلية، مع المحارف المقروءة بجانبها لتبرز النصوص المخبوءة. تقرأ الأداة الرقم السحري لتخبرك بحقيقة الملف — وتنبّهك حين يختلف الامتداد عن المحتوى، وهو ما لن يفعله أي مدير ملفات. ابحث عن نص أو تسلسل بايتات، وانتقل إلى أي إزاحة. لا يُرفع شيء.',
  },
}
