import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ReceiptIcon } from '../../components/icons'

export const rettTool: Tool = {
  id: 'rett',
  name: 'Property Transaction Tax (RETT)',
  tagline: 'Five per cent, once — and not fifteen on top.',
  description:
    'What the 5% Real Estate Transaction Tax comes to on a sale or transfer: why the 15% VAT does not also apply, how the first-home relief tapers above SAR 1,000,000 rather than cutting off, and why the late penalty is 2% a month and not the 5% much of the web still prints. Runs entirely in your browser.',
  category: 'Saudi / Local',
  keywords: [
    'rett', 'real estate transaction tax', 'property tax', 'property transaction tax',
    'selling a house tax', 'sell property', 'transfer property', 'title deed', 'deed',
    'first home exemption', 'sakani', 'zatca', 'property purchase tax', 'house sale tax',
    'stamp duty', 'conveyancing', 'notary', 'ifragh',
    'ضريبة التصرفات العقارية', 'التصرفات العقارية', 'ضريبة عقارية', 'ضريبة العقار', 'ضريبة بيع العقار',
    'بيع عقار', 'نقل ملكية', 'الإفراغ', 'إفراغ', 'صك', 'المسكن الأول', 'إعفاء المسكن الأول',
    'سكني', 'شراء بيت', 'شراء عقار', 'الرقم المرجعي',
  ],
  status: 'beta',
  Icon: ReceiptIcon,
  component: lazyTool(() => import('./RettTool')),
  ar: {
    name: 'التصرفات العقارية',
    tagline: 'خمسة بالمئة مرّة واحدة — لا خمسة عشر فوقها.',
    description:
      'كم تبلغ ضريبة التصرفات العقارية ٥٪ عند بيع عقار أو نقل ملكيته: لماذا لا تُضاف إليها ضريبة القيمة المضافة ١٥٪، وكيف يتدرّج إعفاء المسكن الأول فوق مليون ريال بدل أن ينقطع، ولماذا غرامة التأخير ٢٪ شهريًا لا ٥٪ كما يُنشر في كثير من المواقع. يعمل بالكامل داخل متصفحك.',
  },
}
