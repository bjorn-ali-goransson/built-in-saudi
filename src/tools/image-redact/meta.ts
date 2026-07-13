import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { RedactIcon } from '../../components/icons'

export const imageRedactTool: Tool = {
  id: 'image-redact',
  name: 'Image Redactor',
  tagline: 'Blur or black-out parts of an image.',
  description:
    'Drop an image and drag boxes over anything sensitive — faces, names, numbers — to pixelate or black it out, then download the redacted picture. The redaction is baked into the pixels (not a removable overlay), and everything runs on your device.',
  category: 'Images',
  keywords: ['redact', 'blur', 'censor', 'hide', 'privacy', 'pixelate', 'black out', 'تمويه', 'حجب', 'خصوصية'],
  status: 'stable',
  Icon: RedactIcon,
  component: lazyTool(() => import('./ImageRedactTool')),
  ar: {
    name: 'محرّر تمويه الصور',
    tagline: 'موّه أو احجب أجزاءً من الصورة.',
    description:
      'أفلت صورة واسحب مربّعات فوق أي شيء حسّاس — وجوه، أسماء، أرقام — لتبكسله أو تحجبه، ثم نزّل الصورة المموّهة. يُدمج التمويه في البكسلات (وليس طبقة قابلة للإزالة)، وكل شيء يجري على جهازك.',
  },
}
