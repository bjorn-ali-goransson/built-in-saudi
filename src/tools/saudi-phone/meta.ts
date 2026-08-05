import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { PhoneIcon } from '../../components/icons'

export const saudiPhoneTool: Tool = {
  id: 'saudi-phone',
  name: 'Saudi Phone Formatter',
  nameAr: 'منسّق الأرقام السعودية',
  tagline: 'Any shape of Saudi number in, every standard format out.',
  description:
    'Clean up and check Saudi phone numbers. Paste one in any shape — with or without +966, the leading zero, spaces, dashes or Arabic-Indic digits — and get the E.164, national and international forms, whether it is a mobile or a landline, the area it belongs to, and a WhatsApp link. Paste a whole list to validate them in bulk. Runs entirely in your browser.',
  category: 'Saudi / Local',
  keywords: ['saudi', 'phone', 'number', 'format', 'validate', '+966', 'e164', 'whatsapp', 'جوال', 'رقم', 'تنسيق', 'التحقق', 'سعودي'],
  status: 'stable',
  Icon: PhoneIcon,
  component: lazyTool(() => import('./SaudiPhoneTool')),
  ar: {
    name: 'منسّق الأرقام السعودية',
    tagline: 'أي صيغة رقم سعودي تدخل، وكل الصيغ القياسية تخرج.',
    description:
      'نظّف أرقام الهاتف السعودية وتحقّق منها. الصق رقمًا بأي صيغة — بـ+966 أو بدونه، بالصفر أو بدونه، بمسافات أو شرطات أو أرقام هندية — واحصل على صيغ E.164 والمحلية والدولية، ونوعه جوال أم أرضي، والمنطقة التي يتبعها، ورابط واتساب. والصق قائمة كاملة للتحقق منها دفعة واحدة. يعمل بالكامل في متصفحك.',
  },
}
