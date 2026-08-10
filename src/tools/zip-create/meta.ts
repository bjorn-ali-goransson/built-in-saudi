import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ArchiveIcon } from '../../components/icons'

export const zipCreateTool: Tool = {
  id: 'zip-create',
  name: 'Create a ZIP',
  tagline: 'Bundle files into one archive, on your device.',
  description:
    'Put several files into one .zip without uploading them anywhere — properly compressed, with Arabic filenames that survive, and an honest answer about why there is no password option. The other half of the archive inspector.',
  category: 'Files',
  keywords: [
    'zip', 'zip files', 'create zip', 'make a zip', 'compress files', 'archive',
    'bundle files', 'compress folder', 'zip folder', 'combine files',
    'ضغط ملفات', 'إنشاء zip', 'أرشيف', 'ضغط مجلد', 'دمج ملفات في ملف واحد',
  ],
  inverse: 'archive-inspector',
  status: 'stable',
  Icon: ArchiveIcon,
  component: lazyTool(() => import('./ZipCreateTool')),
  ar: {
    name: 'ضغط الملفات في ZIP',
    tagline: 'اجمع الملفات في أرشيف واحد على جهازك.',
    description:
      'ضع عدة ملفات في ملف ‎.zip‎ واحد دون رفعها إلى أي مكان — مضغوطة فعلًا، وبأسماء عربية تبقى سليمة، مع جواب صريح عن سبب غياب خيار كلمة المرور. وهو النصف الآخر لفاحص الأرشيف.',
  },
}
