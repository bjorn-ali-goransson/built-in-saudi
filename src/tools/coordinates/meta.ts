import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CompassIcon } from '../../components/icons'

export const coordinatesTool: Tool = {
  id: 'coordinates',
  name: 'Coordinate Converter',
  nameAr: 'محوّل الإحداثيات',
  tagline: 'Decimal, DMS, UTM and MGRS — the same point, every notation.',
  description:
    'Paste coordinates in any common form — decimal, degrees-minutes-seconds, or degrees and decimal minutes, in Arabic-Indic digits if you like — and get every other form back, including UTM and MGRS for survey and field maps. Add a second point to get the distance and bearing between them. Everything is computed on your device.',
  category: 'Calculators',
  keywords: ['coordinates', 'gps', 'latitude', 'longitude', 'dms', 'utm', 'mgrs', 'convert', 'إحداثيات', 'خطوط الطول', 'دوائر العرض', 'تحويل', 'خرائط'],
  status: 'stable',
  Icon: CompassIcon,
  component: lazyTool(() => import('./CoordinatesTool')),
  ar: {
    name: 'محوّل الإحداثيات',
    tagline: 'عشري ودرجات وUTM وMGRS — النقطة نفسها بكل الصيغ.',
    description:
      'الصق إحداثيات بأي صيغة شائعة — عشرية أو درجات ودقائق وثوانٍ أو درجات ودقائق عشرية، وبأرقام هندية إن شئت — لتحصل على بقية الصيغ، بما فيها UTM وMGRS لخرائط المساحة والميدان. أضف نقطة ثانية لتعرف المسافة والاتجاه بينهما. كل الحسابات تجري على جهازك.',
  },
}
