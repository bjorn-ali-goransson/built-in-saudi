import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ReceiptIcon } from '../../components/icons'

export const zatcaWaveTool: Tool = {
  id: 'zatca-wave',
  name: 'Which E-Invoicing Wave Am I In?',
  nameAr: 'أي موجة فوترة إلكترونية أنا فيها؟',
  tagline: 'Your ZATCA Fatoora integration deadline.',
  description:
    'Find which ZATCA e-invoicing wave your business falls into and by when it must be integrated with Fatoora. Two things about the rule catch people out. The threshold is met if ANY ONE of 2022, 2023 or 2024 crossed it — not the latest year, not an average, so a good 2022 followed by two quiet years still counts. And a bigger business has an EARLIER deadline: the waves started at SAR 3 billion and step down, so reading the lowest published threshold and taking its date can hand you months you do not have. The tool also says plainly that ZATCA notifies each taxpayer directly at least six months ahead, and that letter — not this page — is the official trigger.',
  category: 'Saudi / Local',
  keywords: [
    'zatca wave', 'e-invoicing wave', 'fatoora', 'phase 2', 'einvoicing deadline', 'integration deadline',
    'wave 23', 'wave 24', 'wave 25', 'e-invoice', 'zatca', 'vat revenue', 'when do i have to integrate',
    'موجة الفوترة', 'الفوترة الإلكترونية', 'فاتورة', 'المرحلة الثانية', 'الربط', 'موعد الربط',
    'زاتكا', 'هيئة الزكاة', 'الإيرادات الخاضعة',
  ],
  status: 'beta',
  Icon: ReceiptIcon,
  component: lazyTool(() => import('./ZatcaWaveTool')),
  ar: {
    name: 'أي موجة فوترة إلكترونية أنا فيها؟',
    tagline: 'موعد ربطك مع فاتورة.',
    description:
      'اعرف في أي موجة من موجات الفوترة الإلكترونية تقع منشأتك، ومتى يجب ربطها مع فاتورة. وأمران في القاعدة يخدعان الناس: يتحقق الحد إذا تجاوزته أي سنة من 2022 أو 2023 أو 2024 — لا الأحدث ولا المتوسط، فسنة 2022 جيدة تليها سنتان هادئتان تكفي. والمنشأة الأكبر موعدها أبكر: فالموجات بدأت من ثلاثة مليارات ريال وتنزل تدريجيًا، والاكتفاء بأدنى حد منشور وأخذ تاريخه قد يمنحك أشهرًا لا تملكها. وتقول الأداة صراحةً إن الهيئة تخاطب كل مكلّف مباشرةً قبل موعده بستة أشهر على الأقل، وذلك الإشعار — لا هذه الصفحة — هو المرجع الرسمي.',
  },
}
