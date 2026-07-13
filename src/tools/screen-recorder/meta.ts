import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { RecordIcon } from '../../components/icons'

export const screenRecorderTool: Tool = {
  id: 'screen-recorder',
  name: 'Screen Recorder',
  tagline: 'Record your screen (and mic) to a video file.',
  description:
    'Record a screen, window or browser tab — optionally with your microphone — straight to a video file you can download. The recording is captured and saved entirely on your device; nothing is uploaded or streamed anywhere.',
  category: 'Images',
  keywords: ['screen recorder', 'record screen', 'capture', 'video', 'screencast', 'webm', 'تسجيل الشاشة', 'تصوير الشاشة'],
  status: 'stable',
  Icon: RecordIcon,
  component: lazyTool(() => import('./ScreenRecorderTool')),
  ar: {
    name: 'مسجّل الشاشة',
    tagline: 'سجّل شاشتك (والمايك) إلى ملف فيديو.',
    description:
      'سجّل شاشة أو نافذة أو تبويبًا — مع المايك اختياريًا — مباشرةً إلى ملف فيديو يمكنك تنزيله. يُلتقط التسجيل ويُحفظ بالكامل على جهازك؛ لا يُرفع أو يُبثّ في أي مكان.',
  },
}
