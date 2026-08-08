import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { UsersIcon } from '../../components/icons'

export const csvVcardTool: Tool = {
  id: 'csv-vcard',
  name: 'Spreadsheet to Contacts',
  nameAr: 'جدول إلى جهات اتصال',
  tagline: 'Get 300 people out of a spreadsheet and into your phone.',
  description:
    'Turn a CSV or Excel list of people into a .vcf your phone will import — names, numbers, emails, companies and job titles. Columns are matched by their headings and you can correct them. Saudi numbers are rewritten in international form, because 0512345678 stops meaning anything once the phone leaves the country. Nothing is uploaded.',
  category: 'Converters',
  keywords: [
    // The DIRECTIONAL phrase leads, and it is what makes this tool separable
    // from its inverse. Terms are scored independently and word order is
    // discarded on purpose, so "vcf to csv" and "csv to vcf" are the same query
    // to the scorer — two formats, both matching both tools, decided by nothing
    // better than which listed them nearer the front. Indexing the phrase gives
    // the whole-query path something to bite on, so the arrow points somewhere.
    'csv to vcf', 'csv to vcard', 'spreadsheet to contacts', 'excel to contacts',
    'vcard', 'vcf', 'contacts', 'csv', 'excel', 'xlsx', 'import', 'phone', 'address book', 'convert', 'bulk',
    'جهات اتصال', 'جدول', 'استيراد', 'هاتف', 'دفتر عناوين', 'تحويل', 'إكسل',
  ],
  status: 'stable',
  Icon: UsersIcon,
  component: lazyTool(() => import('./CsvVcardTool')),
  ar: {
    name: 'جدول إلى جهات اتصال',
    tagline: 'أخرج ٣٠٠ شخص من جدول وأدخلهم هاتفك.',
    description:
      'حوّل قائمة أشخاص في ملف CSV أو إكسل إلى ملف ‎.vcf‎ يستورده هاتفك — أسماء وأرقام وبُرد إلكترونية وشركات ومسمّيات وظيفية. تُطابَق الأعمدة من عناوينها ويمكنك تصحيحها. وتُعاد كتابة الأرقام السعودية بالصيغة الدولية، لأن 0512345678 يفقد معناه متى خرج الهاتف من البلد. ولا يُرفع شيء.',
  },
}
