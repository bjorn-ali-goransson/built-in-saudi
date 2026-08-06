import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ScissorsIcon } from '../../components/icons'

export const videoTrimTool: Tool = {
  id: 'video-trim',
  name: 'Video Trimmer',
  nameAr: 'قص الفيديو',
  tagline: 'Cut a clip without re-encoding it.',
  description:
    'Trim an MP4 or MOV in your browser by copying its frames rather than re-encoding them — so the output is the same video at the same quality, and a half-hour recording trims in seconds instead of minutes. The start of a cut snaps to the nearest keyframe, which the tool shows you on the timeline. Nothing is uploaded.',
  category: 'Files',
  keywords: [
    'video', 'trim', 'cut', 'clip', 'mp4', 'mov', 'shorten', 'crop video', 'lossless', 'no re-encode', 'split',
    'فيديو', 'قص', 'اقتطاع', 'مقطع', 'تقصير', 'بدون إعادة ترميز', 'دون رفع',
  ],
  status: 'beta',
  Icon: ScissorsIcon,
  component: lazyTool(() => import('./VideoTrimTool')),
  ar: {
    name: 'قص الفيديو',
    tagline: 'اقتطع مقطعًا دون إعادة ترميزه.',
    description:
      'اقتطع ملف MP4 أو MOV داخل متصفحك بنسخ إطاراته بدل إعادة ترميزها — فيخرج المقطع نفسه بالجودة نفسها، ويُقتطع تسجيل نصف الساعة في ثوانٍ لا دقائق. وتنتقل بداية القص إلى أقرب إطار مفتاحي، وتعرض الأداة هذه الإطارات على الشريط الزمني. ولا يُرفع شيء.',
  },
}
