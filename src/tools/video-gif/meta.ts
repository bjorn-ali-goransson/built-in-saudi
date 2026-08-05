import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { VideoCallIcon } from '../../components/icons'

export const videoGifTool: Tool = {
  id: 'video-gif',
  name: 'Video to GIF',
  nameAr: 'فيديو إلى صورة متحركة',
  tagline: 'A few seconds of video, as a GIF, on your device.',
  description:
    'Turn a clip into an animated GIF without uploading it anywhere. Choose where it starts, how long it runs, the frame rate, the width and how many colours, and it steps through the video frame by frame. All the frames share one palette, so the animation does not flicker the way cheap converters make it, and it tells you when the file has grown past the point anyone will wait for it.',
  category: 'Files',
  keywords: ['gif', 'video to gif', 'animated', 'convert', 'clip', 'mp4', 'فيديو', 'صورة متحركة', 'تحويل', 'مقطع', 'جيف'],
  status: 'stable',
  Icon: VideoCallIcon,
  component: lazyTool(() => import('./VideoGifTool')),
  ar: {
    name: 'تحويل الفيديو إلى صورة متحركة',
    tagline: 'بضع ثوانٍ من الفيديو، صورةً متحركة، على جهازك.',
    description:
      'حوّل مقطعًا إلى صورة GIF متحركة دون رفعه إلى أي مكان. اختر البداية والمدة ومعدّل الإطارات والعرض وعدد الألوان، وستمرّ الأداة على الفيديو إطارًا إطارًا. وتتشارك كل الإطارات لوحة ألوان واحدة فلا ترتجف الحركة كما تفعل المحوّلات الرديئة، وتنبّهك حين يتجاوز حجم الملف ما يصبر عليه أحد.',
  },
}
