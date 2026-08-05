import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ScissorsIcon } from '../../components/icons'

export const audioTrimTool: Tool = {
  id: 'audio-trim',
  name: 'Audio Trimmer',
  nameAr: 'قص الصوت',
  tagline: 'Cut a clip out of any audio file, in your browser.',
  description:
    'Open an MP3, M4A, WAV, OGG or FLAC, drag across the waveform to pick the part you want, listen back to check it, and save just that. A short fade at each end stops the cut clicking. Everything happens on your device — the file is never uploaded, and there is no length limit but your own memory.',
  category: 'Files',
  keywords: ['audio', 'trim', 'cut', 'mp3', 'ringtone', 'clip', 'wav', 'صوت', 'قص', 'تقطيع', 'نغمة', 'مقطع'],
  status: 'stable',
  Icon: ScissorsIcon,
  component: lazyTool(() => import('./AudioTrimTool')),
  ar: {
    name: 'قص الملفات الصوتية',
    tagline: 'اقتطع مقطعًا من أي ملف صوتي، داخل متصفحك.',
    description:
      'افتح ملف MP3 أو M4A أو WAV أو OGG أو FLAC، واسحب على الموجة لاختيار الجزء الذي تريده، واستمع إليه للتأكد، ثم احفظه وحده. ويمنع تلاشٍ قصير في الطرفين صوت الطقطقة عند القص. كل شيء يجري على جهازك — لا يُرفع الملف أبدًا، ولا حدّ للمدة سوى ذاكرة جهازك.',
  },
}
