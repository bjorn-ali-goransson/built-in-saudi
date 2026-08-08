import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ImageIcon } from '../../components/icons'

export const videoFramesTool: Tool = {
  id: 'video-frames',
  name: 'Video to Image',
  nameAr: 'لقطة من الفيديو',
  tagline: 'Take a still out of a video.',
  description:
    'Scrub to the moment you want and save it as a PNG, JPG or WebP — a thumbnail, a poster frame, or the one shot you needed out of a long clip. Or take one frame every few seconds and download the lot as a zip. The video is read by your own browser and never uploaded, which is the whole difference from the sites that ask for the file first. It is honest about the one limit that matters: a browser seeks to the nearest frame it can decode by itself, so on a video with widely spaced keyframes you may land a moment either side of the time you asked for — which is why the frame is shown before you save it.',
  category: 'Images',
  keywords: [
    'video to image', 'video frame', 'grab a frame', 'screenshot from video', 'still from video',
    'thumbnail from video', 'poster frame', 'video to png', 'video to jpg', 'extract frames',
    'contact sheet', 'freeze frame', 'snapshot', 'mp4 to image',
    'لقطة من الفيديو', 'صورة من فيديو', 'إطار', 'مصغّرة', 'استخراج لقطات', 'تصدير صورة',
  ],
  status: 'stable',
  Icon: ImageIcon,
  component: lazyTool(() => import('./VideoFramesTool')),
  ar: {
    name: 'لقطة من الفيديو',
    tagline: 'خُذ صورة ثابتة من مقطع فيديو.',
    description:
      'انتقل إلى اللحظة التي تريدها واحفظها بصيغة PNG أو JPG أو WebP — مصغّرة، أو لقطة غلاف، أو الصورة الوحيدة التي احتجتها من مقطع طويل. أو خُذ لقطة كل بضع ثوانٍ ونزّلها كلها في ملف مضغوط. ويقرأ متصفحك الفيديو ولا يُرفع أبدًا، وهذا هو الفرق كله عن المواقع التي تطلب الملف أولًا. وهي صريحة في الحد الوحيد المهم: يقفز المتصفح إلى أقرب لقطة يفك ترميزها وحدها، ففي فيديو تتباعد فيه اللقطات المفتاحية قد تحصل على صورة قبل الوقت المطلوب أو بعده بلحظة — ولهذا تُعرض اللقطة قبل حفظها.',
  },
}
