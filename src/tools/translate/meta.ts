import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TranslateIcon } from '../../components/icons'

export const translateTool: Tool = {
  id: 'translate',
  name: 'Translator',
  nameAr: 'ترجمة النصوص',
  tagline: 'Runs on your device — the text never leaves.',
  description:
    'Translate between Arabic and 50+ languages using a model that runs inside your browser, so nothing you type is uploaded anywhere — and it keeps working with no connection once the language pack is downloaded. Covers the languages actually spoken at work here: Urdu, Hindi, Bengali, Malayalam, Tamil, Nepali, Sinhala, Amharic, Tigrinya, Somali, Pashto and Farsi. Needs Chrome or Edge 138+ on a computer.',
  category: 'Text',
  keywords: [
    'translate', 'translator', 'translation', 'arabic', 'english', 'urdu', 'hindi', 'bengali', 'malayalam', 'tamil',
    'offline', 'private', 'on-device', 'no upload',
    'ترجمة', 'مترجم', 'عربي', 'إنجليزي', 'أردو', 'هندي', 'بنغالي', 'دون اتصال', 'خصوصية', 'على الجهاز',
  ],
  status: 'beta',
  Icon: TranslateIcon,
  component: lazyTool(() => import('./TranslateTool')),
  ar: {
    name: 'ترجمة النصوص',
    tagline: 'يعمل على جهازك — ولا يغادر النص أبدًا.',
    description:
      'ترجم بين العربية وأكثر من ٥٠ لغة عبر نموذج يعمل داخل متصفحك، فلا يُرفع شيء مما تكتبه إلى أي مكان — ويظل يعمل دون اتصال بعد تنزيل حزمة اللغة. ويغطي اللغات المستخدمة فعلًا في العمل هنا: الأردية والهندية والبنغالية والمالايالامية والتاميلية والنيبالية والسنهالية والأمهرية والتيغرينية والصومالية والبشتوية والفارسية. يتطلب Chrome أو Edge 138+ على حاسوب.',
  },
}
