import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ExchangeIcon } from '../../components/icons'

export const currencyConverterTool: Tool = {
  id: 'currency-converter',
  name: 'Currency Converter',
  nameAr: 'محوّل العملات',
  tagline: 'Convert between currencies at daily rates — SAR-first.',
  description:
    'Convert between the Saudi Riyal and world currencies at up-to-date daily reference rates. Pick two currencies, type an amount, and see the conversion instantly — swap direction in a tap. Rates are fetched from a free public feed and cached so it keeps working offline; your amounts never leave your browser.',
  category: 'Converters',
  keywords: ['currency', 'converter', 'exchange rate', 'forex', 'sar', 'riyal', 'usd', 'eur', 'dollar', 'euro', 'عملات', 'محول', 'سعر الصرف', 'ريال', 'دولار', 'تحويل عملة'],
  status: 'stable',
  Icon: ExchangeIcon,
  component: lazyTool(() => import('./CurrencyConverterTool')),
  ar: {
    name: 'محوّل العملات',
    tagline: 'حوّل بين العملات بأسعار يومية — الريال أولًا.',
    description:
      'حوّل بين الريال السعودي وعملات العالم بأسعار مرجعية يومية محدّثة. اختر عملتين واكتب المبلغ لترى النتيجة فورًا، وبدّل الاتجاه بنقرة. تُجلب الأسعار من مصدر عام مجاني وتُحفظ للعمل دون اتصال؛ ولا تغادر مبالغك متصفحك.',
  },
}
