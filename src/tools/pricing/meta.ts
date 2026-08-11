import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TagIcon } from '../../components/icons'

export const pricingTool: Tool = {
  id: 'pricing',
  name: 'Product Pricing & Margin',
  tagline: 'The price you advertise is not the money you keep.',
  description:
    'What a sale actually leaves you here, where the advertised price already includes the 15% and the payment fee is taken on the whole of it — plus the price to display to truly hit the margin you want, and why markup is not margin. Runs entirely in your browser.',
  category: 'Business',
  keywords: [
    'pricing', 'price a product', 'profit margin', 'margin', 'markup', 'gross margin',
    'selling price', 'cost price', 'break even', 'how much profit', 'what do i keep',
    'payment gateway fee', 'platform fee', 'commission', 'online store', 'ecommerce',
    'salla', 'zid', 'shopify', 'reseller', 'wholesale', 'retail price',
    'تسعير المنتج', 'هامش الربح', 'الربح', 'نسبة الربح', 'سعر البيع', 'التكلفة',
    'كم أربح', 'رسوم الدفع', 'عمولة المنصة', 'متجر إلكتروني', 'سلة', 'زد', 'تاجر',
    'بيع بالتجزئة', 'تسعير',
  ],
  status: 'beta',
  Icon: TagIcon,
  component: lazyTool(() => import('./PricingTool')),
  ar: {
    name: 'تسعير المنتج وهامش الربح',
    tagline: 'السعر الذي تعلنه ليس المال الذي يبقى لك.',
    description:
      'كم تترك لك عملية البيع فعلًا هنا، حيث السعر المعلن شامل للضريبة أصلًا والرسوم تُقتطع من كامله — مع السعر الواجب عرضه لتحقيق الهامش الذي تريده حقًا، ولماذا نسبة الإضافة ليست الهامش. يعمل بالكامل داخل متصفحك.',
  },
}
