import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { MicIcon } from '../../components/icons'

export const audioConvertTool: Tool = {
  id: 'audio-convert',
  name: 'Audio Converter',
  nameAr: 'محوّل الصوت',
  tagline: 'Any audio file to WAV, and a look at its frequencies.',
  description:
    'Turn an M4A voice memo, an OGG, an AAC or a FLAC into a WAV that every piece of software accepts — and pick the sample rate and channels while you are there. 16 kHz mono is what transcription and speech software expects and is roughly a sixth the size of 44.1 kHz stereo; the tool shows the resulting size before you commit to it. Resampling is done by the browser’s own band-limited resampler rather than a hand-rolled one, so downsampling does not alias. A second mode draws the file’s spectrogram and finds where its frequencies stop — the wall a lossy encoder leaves — so an MP3 sold as 320 kbps that was made from a 128 one shows itself. The file is decoded on your device and never uploaded.',
  category: 'Files',
  keywords: [
    'audio converter', 'convert audio', 'm4a to wav', 'mp3 to wav', 'aac to wav', 'ogg to wav', 'flac to wav',
    'opus', 'voice memo', 'wav', 'sample rate', 'resample', '16khz', 'mono', 'stereo', 'downsample',
    'transcription', 'whisper', 'speech', 'audio format',
    'تحويل الصوت', 'محوّل صوتي', 'صيغة صوتية', 'مذكرة صوتية', 'معدل العينات', 'أحادي', 'ثنائي', 'تفريغ صوتي',
    // Merged in from the Audio Spectrum Analyser (November 2026).
    'spectrum', 'spectrogram', 'frequency', 'fft', 'analyser', 'analyzer', 'bitrate', 'lossless', 'cutoff', 'fake bitrate',
    'طيف', 'تحليل صوتي', 'تردد', 'جودة الصوت', 'معدل البت',
  ],
  aliases: ['Audio Spectrum Analyser', 'محلّل الطيف الصوتي'],
  status: 'stable',
  Icon: MicIcon,
  component: lazyTool(() => import('./AudioConvertTool')),
  ar: {
    name: 'محوّل الصوت',
    tagline: 'أي ملف صوتي إلى WAV، بالمعدّل الذي تريده.',
    description:
      'حوّل مذكرة صوتية بصيغة M4A أو ملف OGG أو AAC أو FLAC إلى ملف WAV يقبله كل برنامج — واختر معدّل العيّنات وعدد القنوات وأنت هناك. فـ16 كيلوهرتز أحادي هو ما تتوقعه برامج التفريغ والتعرّف على الكلام، وحجمه نحو سدس 44.1 كيلوهرتز ثنائي، والأداة تعرض الحجم الناتج قبل أن تلتزم به. وإعادة أخذ العيّنات يتولاها مُعيد العيّنات المحدود النطاق في المتصفح نفسه لا واحد مكتوب باليد، فلا يحدث تشوّه عند خفض المعدّل. وفي وضع ثانٍ ترسم الأداة طيف الملف وتجد أين تتوقّف تردداته — الجدار الذي يتركه الترميز المضغوط — فيظهر ملف MP3 يُباع على أنه 320 كيلوبت وهو مصنوع من 128. ويُفكّ ترميز الملف على جهازك ولا يُرفع أبدًا.',
  },
}
