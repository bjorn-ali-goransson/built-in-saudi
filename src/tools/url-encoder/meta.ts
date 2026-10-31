import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { LinkIcon } from '../../components/icons'

export const urlEncoderTool: Tool = {
  id: 'url-encoder',
  name: 'URL & HTML Encoder',
  tagline: 'Encode and decode URLs and HTML entities.',
  description:
    'Encode or decode text for URLs (percent-encoding, whole-URL or component) and HTML (entities like &amp; and &#39;), both directions, as you type. Handy for query strings, links and escaping markup. Runs entirely in your browser.',
  category: 'Developer',
  keywords: ['url encode', 'url decode', 'percent encoding', 'html entities', 'escape', 'uri', 'encode', 'ترميز', 'رابط'],
  status: 'stable',
  Icon: LinkIcon,
  component: lazyTool(() => import('./UrlEncoderTool')),
  ar: {
    name: 'مُرمِّز الروابط وHTML',
    tagline: 'رمِّز وفكّ ترميز الروابط وكيانات HTML.',
    description:
      'رمِّز أو فُكّ ترميز النص للروابط (ترميز النسبة المئوية، رابط كامل أو جزء) ولـHTML (كيانات مثل &amp; و&#39;) في الاتجاهين أثناء الكتابة. مفيد لسلاسل الاستعلام والروابط وتهريب الوسوم. يعمل بالكامل في متصفحك.',
  },
}
