import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { AddressPinIcon } from '../../components/icons'

export const shortAddressTool: Tool = {
  id: 'short-address',
  name: 'Short Address Checker',
  nameAr: 'مدقّق العنوان المختصر',
  tagline: 'Check a National Address code before you ship.',
  description:
    'Check a Saudi National Address short code — four letters then four digits, like RRRD2929. It catches the ways that goes wrong (digits typed first, a space in the middle, a zero read as an O, Arabic-Indic numerals) and explains what each part means. Format only: only Saudi Post can turn a code into a street, so it links you there instead of guessing. Runs entirely in your browser.',
  category: 'Saudi / Local',
  keywords: [
    'short address', 'national address', 'wasel', 'spl', 'saudi post', 'building number', 'shipping', 'delivery', 'validate',
    'العنوان المختصر', 'العنوان الوطني', 'واصل', 'البريد السعودي', 'رقم المبنى', 'شحن', 'توصيل', 'تحقق',
  ],
  status: 'stable',
  Icon: AddressPinIcon,
  component: lazyTool(() => import('./ShortAddressTool')),
  ar: {
    name: 'مدقّق العنوان المختصر',
    tagline: 'تحقّق من رمز العنوان الوطني قبل الشحن.',
    description:
      'تحقّق من رمز العنوان الوطني المختصر — أربعة حروف ثم أربعة أرقام، مثل RRRD2929. تلتقط الأداة ما يختل في ذلك (كتابة الأرقام أولًا، أو مسافة في المنتصف، أو صفر مكان الحرف O، أو أرقام هندية) وتشرح معنى كل جزء. الصيغة فقط: فالبريد السعودي وحده يحوّل الرمز إلى شارع، ولذلك تحيلك إليه بدل التخمين. تعمل داخل متصفحك بالكامل.',
  },
}
