import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { MicIcon } from '../../components/icons'

export const tunerTool: Tool = {
  id: 'tuner',
  name: 'Instrument Tuner',
  nameAr: 'موالف الآلات',
  tagline: 'Guitar, oud, violin — tuned in the browser.',
  description:
    'A chromatic tuner with presets for guitar, bass, ukulele, oud and violin, and an adjustable reference pitch for ensembles that do not tune to 440. Pitch is found by autocorrelation, not by picking the loudest peak in a spectrum — on a guitar or an oud the loudest partial is often the second harmonic, so a peak-picking tuner reads the low string an octave high. The audio never leaves the page.',
  category: 'Generators',
  keywords: ['tuner', 'guitar tuner', 'oud', 'violin', 'pitch', 'chromatic', 'موالف', 'دوزان', 'عود', 'جيتار', 'كمان', 'ضبط النغمة'],
  status: 'stable',
  Icon: MicIcon,
  component: lazyTool(() => import('./TunerTool')),
  ar: {
    name: 'موالف الآلات الموسيقية',
    tagline: 'جيتار وعود وكمان — دوزان في المتصفح.',
    description:
      'موالف كروماتي بإعدادات جاهزة للجيتار والباص واليوكوليلي والعود والكمان، مع نغمة مرجعية قابلة للضبط للفرق التي لا تضبط على ٤٤٠. تُستخرج النغمة بالارتباط الذاتي لا باختيار أعلى قمة في الطيف — ففي الجيتار أو العود يكون أعلى تردد جزئي هو التوافقي الثاني غالبًا، فيقرأ الموالف القائم على القمم الوتر المنخفض أوكتافًا أعلى. ولا يغادر الصوت الصفحة.',
  },
}
