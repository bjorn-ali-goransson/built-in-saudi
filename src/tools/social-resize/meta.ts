import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { AspectIcon } from '../../components/icons'

export const socialResizeTool: Tool = {
  id: 'social-resize',
  name: 'Social Media Resizer',
  nameAr: 'مقاسات السوشال ميديا',
  tagline: 'One image, every platform size, in one download.',
  description:
    'Resize a single image to every size the platforms want — Instagram square, portrait and story, X post and header, LinkedIn, a YouTube thumbnail, a Facebook cover and an Open Graph link preview. Fill and crop or fit the whole image, choose whether the crop keeps the top of the frame, and take them all as one zip. Everything is resized in your browser.',
  category: 'Images',
  keywords: ['social media', 'resize', 'instagram', 'story', 'thumbnail', 'twitter', 'linkedin', 'og image', 'مقاسات', 'تغيير الحجم', 'انستقرام', 'ستوري', 'سوشال'],
  status: 'stable',
  Icon: AspectIcon,
  component: lazyTool(() => import('./SocialResizeTool')),
  ar: {
    name: 'محوّل مقاسات السوشال ميديا',
    tagline: 'صورة واحدة، وكل مقاسات المنصات، بتنزيل واحد.',
    description:
      'غيّر مقاس صورة واحدة إلى كل ما تطلبه المنصات — انستقرام مربع وطولي وستوري، ومنشور وغلاف إكس، ولينكدإن، وصورة يوتيوب المصغّرة، وغلاف فيسبوك، ومعاينة الرابط. اختر الملء مع الاقتصاص أو إظهار الصورة كاملة، وحدّد إن كان الاقتصاص يحفظ أعلى الإطار، ثم خذها كلها في ملف مضغوط واحد. كل ذلك داخل متصفحك.',
  },
}
