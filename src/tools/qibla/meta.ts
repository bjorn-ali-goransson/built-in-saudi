import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CompassIcon } from '../../components/icons'

export const qiblaTool: Tool = {
  id: 'qibla',
  name: 'Qibla Locator',
  nameAr: 'اتجاه القبلة',
  tagline: 'Find the direction of the Kaaba from anywhere.',
  description:
    'Find the Qibla direction from your location — the exact bearing to the Kaaba in Makkah, plus a live compass (where your device supports it) and the distance. Computed in your browser.',
  category: 'Saudi / Local',
  keywords: ['qibla', 'qiblah', 'kaaba', 'makkah', 'mecca', 'compass', 'direction', 'prayer', 'قبلة', 'الكعبة', 'مكة', 'بوصلة'],
  status: 'stable',
  Icon: CompassIcon,
  component: lazyTool(() => import('./QiblaTool')),
  ar: {
    name: 'اتجاه القبلة',
    tagline: 'حدّد اتجاه الكعبة من أي مكان.',
    description:
      'حدّد اتجاه القبلة من موقعك — الاتجاه الدقيق إلى الكعبة في مكة، مع بوصلة مباشرة (حيثما يدعمها جهازك) والمسافة. يُحسب داخل متصفحك.',
  },
}
