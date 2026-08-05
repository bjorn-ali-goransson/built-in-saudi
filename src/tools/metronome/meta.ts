import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TimerIcon } from '../../components/icons'

export const metronomeTool: Tool = {
  id: 'metronome',
  name: 'Metronome',
  nameAr: 'ميقاتية',
  tagline: 'A metronome that stays in time.',
  description:
    'Tempo from 30 to 300, any time signature, subdivisions from eighths to sixteenths, and an accented downbeat. Beats are scheduled on the audio clock rather than a JavaScript timer — a timer drifts by tens of milliseconds under load and stops entirely in a background tab, which is audibly wrong within a few bars. Tap the tempo if you do not know the number.',
  category: 'Generators',
  keywords: ['metronome', 'tempo', 'bpm', 'beat', 'practice', 'music', 'ميقاتية', 'إيقاع', 'ميترونوم', 'تدريب', 'موسيقى', 'نبضة'],
  status: 'stable',
  Icon: TimerIcon,
  component: lazyTool(() => import('./MetronomeTool')),
  ar: {
    name: 'ميقاتية (متـرونوم)',
    tagline: 'ميقاتية تبقى على الإيقاع.',
    description:
      'إيقاع من ٣٠ إلى ٣٠٠، وأي ميزان، وتقسيمات من الثمانية إلى السداسية عشرة، ونبضة أولى مشدّدة. تُجدوَل النبضات على ساعة الصوت لا على مؤقّت جافاسكربت — فالمؤقّت ينحرف بعشرات الأجزاء من الثانية تحت الحمل ويتوقّف تمامًا في تبويب خلفي، وهو خطأ مسموع خلال مازورات قليلة. وانقر الإيقاع إن لم تعرف رقمه.',
  },
}
