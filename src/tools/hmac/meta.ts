import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { KeyIcon } from '../../components/icons'

export const hmacTool: Tool = {
  id: 'hmac',
  name: 'HMAC Generator',
  nameAr: 'مولّد HMAC',
  tagline: 'Sign a message with a secret key, and verify one.',
  description:
    'Compute an HMAC over any message with a shared secret — SHA-256, SHA-1, SHA-384 or SHA-512, with the key given as text, hex or base64, and the result as hex or base64. Paste the value you were sent and it tells you whether it matches, which is what you actually need when debugging a webhook signature. Runs on your browser’s own crypto; nothing is sent anywhere.',
  category: 'Developer',
  keywords: ['hmac', 'sha256', 'signature', 'webhook', 'sign', 'verify', 'hash', 'توقيع', 'تحقق', 'مفتاح', 'ويب هوك'],
  status: 'stable',
  Icon: KeyIcon,
  component: lazyTool(() => import('./HmacTool')),
  ar: {
    name: 'مولّد HMAC والتحقق منه',
    tagline: 'وقّع رسالة بمفتاح سري، وتحقّق من توقيع.',
    description:
      'احسب قيمة HMAC لأي رسالة بمفتاح مشترك — بخوارزميات SHA-256 أو SHA-1 أو SHA-384 أو SHA-512، مع مفتاح بصيغة نص أو hex أو base64، وناتج بصيغة hex أو base64. الصق القيمة التي وصلتك لتخبرك الأداة إن كانت مطابقة، وهو ما تحتاجه فعلًا عند تتبّع توقيع ويب هوك. يعمل بتعمية المتصفح نفسه، ولا يُرسل شيء إلى أي مكان.',
  },
}
