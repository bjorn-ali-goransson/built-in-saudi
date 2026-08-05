import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { SubtitlesIcon } from '../../components/icons'

export const subtitleEditorTool: Tool = {
  id: 'subtitle-editor',
  name: 'Subtitle Editor',
  nameAr: 'محرّر الترجمة',
  tagline: 'Fix out-of-sync subtitles and convert SRT ↔ VTT.',
  description:
    'Open an .srt or .vtt file and put it right: shift every timing earlier or later to fix subtitles that run ahead of the audio, apply a frame-rate correction for subtitles that drift further out as the film goes on, edit any line or timestamp by hand, and save back as SRT or WebVTT. It flags overlapping and reversed cues too. Your file is never uploaded.',
  category: 'Text',
  keywords: ['subtitle', 'srt', 'vtt', 'webvtt', 'sync', 'shift', 'captions', 'ترجمة', 'توقيت', 'تزامن', 'مزامنة', 'convert'],
  status: 'stable',
  Icon: SubtitlesIcon,
  component: lazyTool(() => import('./SubtitleEditorTool')),
  ar: {
    name: 'محرّر ملفات الترجمة',
    tagline: 'أصلح تزامن الترجمة وحوّل بين SRT وVTT.',
    description:
      'افتح ملف ‎.srt أو ‎.vtt وأصلحه: أزِح كل التوقيتات للأمام أو للخلف لعلاج الترجمة التي تسبق الصوت، وطبّق تصحيح معدّل الإطارات للترجمة التي تنحرف أكثر مع تقدّم الفيلم، وعدّل أي سطر أو توقيت يدويًا، ثم احفظ بصيغة SRT أو WebVTT. وتُنبّهك الأداة إلى المقاطع المتداخلة والمعكوسة. لا يُرفع ملفك أبدًا.',
  },
}
