import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CardIcon } from '../../components/icons'

export const ibanValidatorTool: Tool = {
  id: 'iban-validator',
  name: 'IBAN Validator',
  nameAr: 'مدقّق الآيبان',
  tagline: 'Check a Saudi IBAN + identify the bank.',
  description:
    'Validate an IBAN by its ISO 7064 mod-97 checksum, enforce the Saudi SA + 22-digit format, pretty-print it in groups of four, and identify the bank from the code — all in your browser, so the IBAN is never sent anywhere.',
  category: 'Saudi / Local',
  keywords: ['iban', 'validator', 'saudi', 'bank', 'sa', 'checksum', 'آيبان', 'تحقق', 'بنك', 'حساب'],
  status: 'stable',
  Icon: CardIcon,
  component: lazyTool(() => import('./IbanValidatorTool')),
  ar: {
    name: 'مدقّق الآيبان',
    tagline: 'تحقّق من آيبان سعودي وتعرّف على البنك.',
    description:
      'تحقّق من رقم الآيبان عبر خوارزمية mod-97، وتأكّد من صيغة السعودية (SA + ٢٢ رقمًا)، واعرضه بمجموعات من أربعة، وتعرّف على البنك من الرمز — كل ذلك داخل متصفحك دون إرسال الآيبان لأي مكان.',
  },
}
