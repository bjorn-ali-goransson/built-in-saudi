import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { DocPhotoIcon } from '../../components/icons'

export const passportPhotoTool: Tool = {
  id: 'passport-photo',
  name: 'Passport Photo Maker',
  nameAr: 'صور جواز ومعاملات',
  tagline: 'Saudi 4×6, passport 35×45 and visa sizes, cut to spec.',
  description:
    'Turn an ordinary photo into an ID photo at the right size — Saudi 4×6 cm, the 35×45 mm passport standard, US 2×2 in and more. Guides show where the top of your head, your chin and your eyes need to sit, which is the part offices actually check. Print several on one 4×6 or A4 sheet with cut lines. Your photo is cropped in your browser and never uploaded.',
  category: 'Images',
  keywords: ['passport photo', 'id photo', 'visa photo', '4x6', '35x45', 'biometric', 'صورة جواز', 'صورة شخصية', 'مقاس', 'تأشيرة', 'إقامة', 'طباعة'],
  status: 'stable',
  Icon: DocPhotoIcon,
  component: lazyTool(() => import('./PassportPhotoTool')),
  ar: {
    name: 'مولّد صور الجواز والمعاملات',
    tagline: 'مقاس ٤×٦ السعودي و٣٥×٤٥ للجواز ومقاسات التأشيرات، بالمواصفة.',
    description:
      'حوّل صورة عادية إلى صورة رسمية بالمقاس الصحيح — ٤×٦ سم السعودي، ومعيار الجواز ٣٥×٤٥ مم، و٢×٢ إنش الأمريكي وغيرها. تُظهر الخطوط الإرشادية أين يجب أن يقع أعلى الرأس والذقن والعينان، وهو ما تتحقق منه الجهات فعلًا. واطبع عدة نسخ على ورقة ٤×٦ أو A4 مع خطوط القص. تُقتطع صورتك داخل متصفحك ولا تُرفع أبدًا.',
  },
}
