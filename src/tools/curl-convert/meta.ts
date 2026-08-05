import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CodeIcon } from '../../components/icons'

export const curlConvertTool: Tool = {
  id: 'curl-convert',
  name: 'cURL Converter',
  nameAr: 'محوّل أوامر cURL',
  tagline: 'Turn a copied cURL command into code.',
  description:
    'Right-click a request in your browser’s network tab, choose “Copy as cURL”, and paste it here to get the same request as fetch, Node, axios, Python requests or HTTPie. Quoting, line continuations, multiple headers and JSON bodies are handled properly. The command is parsed in your browser — no request is sent, and whatever token is in that Authorization header never leaves the page.',
  category: 'Developer',
  keywords: ['curl', 'fetch', 'axios', 'python', 'requests', 'httpie', 'convert', 'http', 'api', 'تحويل', 'طلب', 'واجهة برمجية'],
  status: 'stable',
  Icon: CodeIcon,
  component: lazyTool(() => import('./CurlConvertTool')),
  ar: {
    name: 'محوّل أوامر cURL',
    tagline: 'حوّل أمر cURL منسوخًا إلى كود.',
    description:
      'انقر بزر الفأرة الأيمن على طلب في تبويب الشبكة بمتصفحك، واختر «Copy as cURL»، والصقه هنا لتحصل على الطلب نفسه بصيغة fetch أو Node أو axios أو Python requests أو HTTPie. تُعالَج علامات الاقتباس وأسطر المتابعة والترويسات المتعددة وأجسام JSON بشكل صحيح. يُحلَّل الأمر داخل متصفحك — فلا يُرسل أي طلب، ولا يغادر الصفحة أي رمز في ترويسة Authorization.',
  },
}
