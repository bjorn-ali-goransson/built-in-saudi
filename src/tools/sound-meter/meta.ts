import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { VolumeIcon } from '../../components/icons'

export const soundMeterTool: Tool = {
  id: 'sound-meter',
  name: 'Sound Level Meter',
  nameAr: 'مقياس مستوى الصوت',
  tagline: 'How loud is it here — relatively speaking.',
  description:
    'A live level meter using your microphone, with a running graph and a peak hold. It shows relative loudness in dBFS, not calibrated decibels: a browser cannot know which microphone it is behind, what gain the operating system applied, or how that microphone responds across the spectrum, and all three are needed for an absolute reading. Good for comparing two rooms or finding the noisy appliance; not for judging whether a workplace is safe.',
  category: 'Calculators',
  keywords: ['sound meter', 'decibel', 'db', 'noise', 'level', 'microphone', 'مقياس الصوت', 'ديسيبل', 'ضوضاء', 'مستوى', 'ميكروفون'],
  status: 'stable',
  Icon: VolumeIcon,
  component: lazyTool(() => import('./SoundMeterTool')),
  ar: {
    name: 'مقياس مستوى الصوت',
    tagline: 'كم يبلغ الضجيج هنا — نسبيًا.',
    description:
      'مقياس مستوى حي عبر الميكروفون، مع رسم متحرك وحفظ للذروة. يعرض الجهارة النسبية بوحدة dBFS لا الديسيبل المعاير: فالمتصفح لا يعرف أي ميكروفون خلفه، ولا الكسب الذي طبّقه نظام التشغيل، ولا استجابة ذلك الميكروفون عبر الطيف، والثلاثة لازمة لأي قراءة مطلقة. مناسب لمقارنة غرفتين أو معرفة مصدر الضجيج؛ لا للحكم على سلامة بيئة عمل.',
  },
}
