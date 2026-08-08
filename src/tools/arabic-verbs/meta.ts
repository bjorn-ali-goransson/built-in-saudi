import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { FeatherIcon } from '../../components/icons'

export const arabicVerbsTool: Tool = {
  id: 'arabic-verbs',
  name: 'Arabic Verb Conjugator',
  nameAr: 'مُصرِّف الأفعال',
  tagline: 'Every form, tense, person — تصريف الأفعال',
  description:
    'Enter an Arabic root and get the full conjugation: past, present (indicative/subjunctive/jussive), imperative and passive across all 13 pronouns, for triliteral Forms I–X and quadriliteral forms — plus the derived nouns (اسم الفاعل، اسم المفعول، المصدر) and the emphatic forms. For Form I you pick the middle-radical vowel. Weak and irregular roots are flagged, with a note for common ones like وصل ⇐ يصل versus وجل ⇐ يوجل. Runs entirely in your browser.',
  category: 'Arabic',
  keywords: ['arabic', 'verb', 'conjugation', 'morphology', 'sarf', 'tasreef', 'أفعال', 'تصريف', 'صرف', 'اسم الفاعل', 'المصدر', 'أوزان'],
  status: 'stable',
  Icon: FeatherIcon,
  component: lazyTool(() => import('./ArabicVerbsTool')),
  ar: {
    name: 'مُصرِّف الأفعال العربية',
    tagline: 'كل الأوزان والأزمنة والضمائر — تصريف كامل',
    description:
      'أدخل جذرًا عربيًّا لتحصل على التصريف الكامل: الماضي والمضارع (مرفوع/منصوب/مجزوم) والأمر والمبني للمجهول عبر الضمائر الثلاثة عشر، للأوزان الثلاثية من فَعَلَ إلى استفعل وللرباعي — مع المشتقات (اسم الفاعل واسم المفعول والمصدر) وصيغ التوكيد. في الوزن الأول تختار حركة العين. تُنبَّه الجذور المعتلّة والشاذّة، مع ملاحظة لشائعها مثل وصل ⇐ يصل مقابل وجل ⇐ يوجل. يعمل بالكامل داخل متصفحك.',
  },
}
