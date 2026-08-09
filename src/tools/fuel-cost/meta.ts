import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { AddressPinIcon } from '../../components/icons'

export const fuelCostTool: Tool = {
  id: 'fuel-cost',
  name: 'Fuel Cost Calculator',
  nameAr: 'حاسبة تكلفة الوقود',
  tagline: 'What the drive to Makkah actually costs.',
  description:
    'Work out the fuel for a trip in whatever unit your car shows — km per litre off the dashboard, litres per 100 km off the spec sheet, or miles per gallon in either of the two gallons that differ by a fifth. Pick a route or type a distance, split it between passengers, and see whether 95 is worth its extra over 91 rather than guessing. Nothing is uploaded.',
  category: 'Calculators',
  keywords: [
    'fuel', 'petrol', 'gas', 'benzine', 'fuel cost', 'trip cost', 'road trip',
    'consumption', 'mpg', 'km per litre', 'l/100km', 'mileage', 'car', 'driving',
    '91', '95', 'octane', 'aramco',
    'وقود', 'بنزين', 'تكلفة الوقود', 'استهلاك', 'رحلة', 'سفر', 'سيارة',
    'كم لكل لتر', 'أوكتان', 'أرامكو', 'تسعيرة الوقود',
  ],
  status: 'beta',
  Icon: AddressPinIcon,
  component: lazyTool(() => import('./FuelCostTool')),
  ar: {
    name: 'حاسبة تكلفة الوقود',
    tagline: 'كم تكلّف الطريق إلى مكة فعلًا.',
    description:
      'احسب وقود رحلتك بالوحدة التي تعرضها سيارتك — كم لكل لتر من لوحة العدادات، أو لتر لكل ١٠٠ كم من النشرة الفنية، أو ميلًا لكل جالون بأيّ من الجالونين اللذين بينهما الخُمس. اختر رحلة أو اكتب المسافة، وقسّمها على الركاب، واعرف هل يستحق ٩٥ زيادته على ٩١ بدل التخمين. ولا يُرفع شيء.',
  },
}
