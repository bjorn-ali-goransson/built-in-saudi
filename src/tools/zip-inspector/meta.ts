import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ArchiveIcon } from '../../components/icons'

export const zipInspectorTool: Tool = {
  id: 'archive-inspector',
  name: 'Archive Inspector',
  nameAr: 'فاحص الأرشيف',
  tagline: 'Peek inside a .zip without extracting — nothing uploaded.',
  description:
    'Inspect a compressed archive right in your browser: detect the format (ZIP, GZIP, 7-Zip, RAR, TAR and more) and, for ZIP files, list every entry with sizes, dates and compression — without extracting or uploading anything.',
  category: 'Files',
  keywords: ['zip', 'open zip', 'open a zip', 'read zip', 'archive', 'compressed', 'inspector', 'unzip', 'contents', 'gzip', 'rar', 'tar', 'أرشيف', 'مضغوط', 'zip'],
  status: 'stable',
  Icon: ArchiveIcon,
  component: lazyTool(() => import('./ZipInspectorTool')),
  ar: {
    name: 'فاحص الأرشيف',
    tagline: 'اطّلع على محتوى ملف .zip دون فكّه — بلا رفع.',
    description:
      'افحص ملفًا مضغوطًا داخل متصفحك: تعرّف على الصيغة (ZIP و GZIP و7-Zip وRAR وTAR وغيرها)، ولملفات ZIP اعرض كل عنصر بحجمه وتاريخه ونسبة ضغطه — دون فكّ أو رفع أي شيء.',
  },
}
