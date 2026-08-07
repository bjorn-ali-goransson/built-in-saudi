import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { MailIcon } from '../../components/icons'

export const emailHeadersTool: Tool = {
  id: 'email-headers',
  name: 'Email Header Analyser',
  nameAr: 'محلّل ترويسات البريد',
  tagline: 'Where a message came from, and whether it checks out.',
  description:
    'Paste the raw headers of an email and see the route it actually took, with the delay at each hop, plus the SPF, DKIM and DMARC verdicts explained in plain words and a note of anything worth a second look — a reply address on another domain, an authentication failure. Parsed in your browser. That matters more here than usual: the headers of a suspicious message carry your own address and your employer’s internal hostnames, and every online analyser asks you to paste exactly that into their server.',
  category: 'Developer',
  keywords: [
    'email', 'headers', 'spf', 'dkim', 'dmarc', 'phishing', 'spam', 'received', 'trace', 'analyse', 'source', 'message',
    'بريد', 'ترويسات', 'تصيد', 'تحليل', 'مصدر', 'رسالة', 'توثيق',
  ],
  status: 'stable',
  Icon: MailIcon,
  component: lazyTool(() => import('./EmailHeadersTool')),
  ar: {
    name: 'محلّل ترويسات البريد',
    tagline: 'من أين جاءت الرسالة، وهل تصمد للفحص.',
    description:
      'الصق ترويسات رسالة بريدية خامًا لترى الطريق الذي سلكته فعلًا وزمن كل محطة، مع نتائج SPF وDKIM وDMARC مشروحة بكلام واضح، وتنبيهًا لما يستحق نظرة ثانية — كعنوان رد على نطاق آخر، أو فشل في التوثيق. يجري التحليل في متصفحك. وهذا هنا أهم من المعتاد: فترويسات الرسالة المشبوهة تحمل عنوانك وأسماء خوادم جهة عملك الداخلية، وكل محلّل على الإنترنت يطلب لصق ذلك بعينه في خادمه.',
  },
}
