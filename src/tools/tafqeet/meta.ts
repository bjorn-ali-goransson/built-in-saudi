import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TextIcon } from '../../components/icons'

export const tafqeetTool: Tool = {
  id: 'tafqeet',
  name: 'Tafqeet (Number to Words)',
  nameAr: 'التفقيط',
  tagline: 'Spell an amount in Arabic words (تفقيط).',
  description:
    'Write any number or amount in Arabic words (tafqeet) — Saudi Riyals with halalas ("فقط … ريالاً و… هللة لا غير") or a plain number, with the correct Arabic grammar for hundreds, thousands and millions. For cheques, invoices and contracts. In your browser.',
  category: 'Arabic',
  keywords: ['tafqeet', 'number to words', 'arabic', 'amount in words', 'cheque', 'تفقيط', 'بالحروف', 'الرقم بالحروف', 'كتابة الأرقام بالحروف', 'الأرقام كتابة', 'كتابة المبلغ', 'ريال'],
  status: 'stable',
  Icon: TextIcon,
  component: lazyTool(() => import('./TafqeetTool')),
  ar: {
    name: 'التفقيط',
    tagline: 'كتابة المبلغ بالأحرف العربية (تفقيط).',
    description:
      'اكتب أي رقم أو مبلغ بالأحرف العربية (تفقيط) — بالريال السعودي مع الهللات («فقط … ريالاً و… هللة لا غير») أو رقمًا مجرّدًا، بالقواعد العربية الصحيحة للمئات والآلاف والملايين. للشيكات والفواتير والعقود. داخل متصفحك.',
  },
}
