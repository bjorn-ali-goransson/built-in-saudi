import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ArchiveIcon } from '../../components/icons'

export const archivesTool: Tool = {
  id: 'archives',
  name: 'ZIP, RAR & GZIP Archives',
  tagline: 'Open or make a .zip, .rar, .gz, .tar or .tar.gz.',
  description:
    'Somebody sent a .rar and your phone will not open it; a download came as .tar.gz; forty photos need to go as one file. This opens ZIP, RAR, GZIP, TAR and .tar.gz archives, lists what is inside, and lets you take out one file or everything at once — and it makes .zip, .tar.gz, .tar and .gz archives from your own files or a whole folder. A password-protected RAR asks for its password. It all happens on your device: the archive and its contents are never uploaded.',
  category: 'Files',
  keywords: [
    'zip', 'unzip', 'rar', 'unrar', 'gzip', 'gunzip', 'gz', 'tar', 'tgz', 'tar.gz', 'archive', 'compressed file',
    'extract', 'extract zip', 'open rar', 'open zip', 'create zip', 'make a zip', 'compress files', 'compress folder',
    'zip a folder', 'decompress', 'rar extractor', 'zip extractor', 'winrar', 'winzip', '7zip',
    'ملف مضغوط', 'ملفات مضغوطة', 'فك الضغط', 'فك ضغط', 'استخراج', 'ضغط ملفات', 'ضغط مجلد', 'أرشيف', 'زيب', 'رار',
    'فتح ملف rar', 'فتح ملف zip',
  ],
  aliases: ['Archive Inspector', 'Create ZIP', 'Unzip', 'Unrar', 'فك ضغط الملفات'],
  status: 'stable',
  Icon: ArchiveIcon,
  component: lazyTool(() => import('./ArchivesTool')),
  ar: {
    name: 'ملفات ZIP وRAR وGZIP المضغوطة',
    tagline: 'افتح ملف ‎.zip‎ أو ‎.rar‎ أو ‎.gz‎ أو ‎.tar‎ أو اصنع واحدًا.',
    description:
      'أرسل لك أحدهم ملف ‎.rar‎ ولا يفتحه جوالك؛ أو جاء تنزيل بصيغة ‎.tar.gz‎؛ أو تريد إرسال أربعين صورة في ملف واحد. تفتح هذه الأداة ملفات ZIP وRAR وGZIP وTAR و‎.tar.gz‎، وتعرض ما فيها، وتتيح لك استخراج ملف واحد أو كل شيء دفعة واحدة — وتصنع ملفات ‎.zip‎ و‎.tar.gz‎ و‎.tar‎ و‎.gz‎ من ملفاتك أو من مجلد كامل. وملف RAR المحمي يطلب كلمة مروره. ويجري ذلك كله على جهازك: فلا يُرفع الملف المضغوط ولا ما فيه.',
  },
}
