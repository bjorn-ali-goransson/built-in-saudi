import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CameraIcon } from '../../components/icons'

export const photoBoothTool: Tool = {
  id: 'photo-booth',
  name: 'Webcam Photo Booth',
  tagline: 'Snap photos from your webcam with filters.',
  description:
    'Take photos with your webcam, apply fun filters, mirror the image, and download each shot. The camera only turns on when you start it, and every photo stays on your device — nothing is uploaded.',
  category: 'Images',
  keywords: ['webcam', 'photo booth', 'camera', 'selfie', 'snapshot', 'filters', 'كاميرا', 'صورة', 'ويب كام'],
  status: 'stable',
  Icon: CameraIcon,
  component: lazyTool(() => import('./PhotoBoothTool')),
  ar: {
    name: 'كشك تصوير الويب كام',
    tagline: 'التقط صورًا من كاميرتك مع مرشّحات.',
    description:
      'التقط صورًا بكاميرا الويب، وطبّق مرشّحات ممتعة، واعكس الصورة، ونزّل كل لقطة. لا تعمل الكاميرا إلا حين تبدأها، وتبقى كل صورة على جهازك — لا يُرفع أي شيء.',
  },
}
