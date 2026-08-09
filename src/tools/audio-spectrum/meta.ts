import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { VolumeIcon } from '../../components/icons'

export const audioSpectrumTool: Tool = {
  id: 'audio-spectrum',
  name: 'Audio Spectrum Analyser',
  nameAr: 'محلّل الطيف الصوتي',
  tagline: 'See whether that 320 kbps file really is one.',
  description:
    'Draw the frequency content of an audio or video file and read off where it stops. A lossy encoder throws away everything above a cutoff, and that cutoff is visible — so a file converted to 320 kbps from a 128 kbps source shows a wall at 16 kHz and is not what it claims. Decoded and analysed in your browser; nothing is uploaded.',
  category: 'Files',
  keywords: [
    'spectrum', 'spectrogram', 'frequency', 'audio', 'fft', 'analyser', 'analyzer',
    'bitrate', 'quality', 'mp3', 'lossless', 'flac', 'cutoff', 'upscaled', 'fake bitrate',
    'طيف', 'تحليل صوتي', 'تردد', 'جودة الصوت', 'معدل البت', 'صوت', 'موجات',
  ],
  status: 'stable',
  Icon: VolumeIcon,
  component: lazyTool(() => import('./AudioSpectrumTool')),
  ar: {
    name: 'محلّل الطيف الصوتي',
    tagline: 'اعرف إن كان ملف ٣٢٠ كيلوبت كذلك فعلًا.',
    description:
      'ارسم المحتوى الترددي لملف صوتي أو مرئي واقرأ أين ينتهي. فالترميز الضائع يتخلّص من كل شيء فوق حدّ معيّن، وهذا الحدّ مرئي — فالملف المحوَّل إلى ٣٢٠ كيلوبت من مصدر ١٢٨ يُظهر جدارًا عند ١٦ كيلوهرتز وليس ما يدّعيه. يجري فك الترميز والتحليل في متصفحك؛ ولا يُرفع شيء.',
  },
}
