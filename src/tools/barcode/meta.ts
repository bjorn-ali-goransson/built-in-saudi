import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { QrIcon } from '../../components/icons'

export const barcodeTool: Tool = {
  id: 'barcode',
  name: 'Barcode Generator',
  nameAr: 'مولّد الباركود',
  tagline: 'EAN, UPC and Code 128, drawn to spec.',
  description:
    'Generate a real, scannable barcode — EAN-13 and EAN-8 for retail, UPC-A for North America, and Code 128 for any text on a shipping or shelf label. The check digit is calculated for you, the digits print underneath the way the standard prints them, and the quiet zone is included because without it a scanner cannot find the code. Download as PNG.',
  category: 'Generators',
  keywords: ['barcode', 'ean13', 'ean', 'upc', 'code128', 'generator', 'label', 'باركود', 'رمز شريطي', 'ملصق', 'مولد', 'منتج'],
  status: 'stable',
  Icon: QrIcon,
  component: lazyTool(() => import('./BarcodeTool')),
  ar: {
    name: 'مولّد الباركود',
    tagline: 'رموز EAN وUPC وCode 128 بالمواصفة.',
    description:
      'ولّد باركود حقيقيًا قابلًا للمسح — EAN-13 وEAN-8 للتجزئة، وUPC-A لأمريكا الشمالية، وCode 128 لأي نص على ملصق شحن أو رف. يُحسب رقم التحقق نيابةً عنك، وتُطبع الأرقام تحته كما يطبعها المعيار، ويُضمَّن الهامش الصامت لأن الماسح لا يجد الرمز بدونه. نزّله بصيغة PNG.',
  },
}
