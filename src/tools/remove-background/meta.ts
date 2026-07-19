import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ScissorsIcon } from '../../components/icons'

export const removeBackgroundTool: Tool = {
  id: 'remove-background',
  name: 'Remove Background',
  nameAr: 'إزالة الخلفية',
  tagline: 'Cut out the background of any photo — on your device.',
  description:
    'Remove the background from a photo automatically, right in your browser. The AI model runs on your device — the image is never uploaded — and you get a transparent PNG to download. Great for product shots, profile pictures and stickers. The model downloads once on first use.',
  category: 'Images',
  keywords: ['background', 'remove', 'remover', 'transparent', 'cutout', 'png', 'photo', 'ai', 'إزالة الخلفية', 'خلفية شفافة', 'قص', 'صورة شفافة'],
  status: 'beta',
  Icon: ScissorsIcon,
  component: lazyTool(() => import('./RemoveBackgroundTool')),
  ar: {
    name: 'إزالة الخلفية',
    tagline: 'اقصّ خلفية أي صورة — على جهازك.',
    description:
      'أزل خلفية الصورة تلقائيًا داخل متصفحك. يعمل نموذج الذكاء الاصطناعي على جهازك — لا تُرفع الصورة — وتحصل على صورة PNG شفافة للتنزيل. مثالي لصور المنتجات والصور الشخصية والملصقات. يُنزَّل النموذج مرة واحدة عند أول استخدام.',
  },
}
