import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TokenIcon } from '../../components/icons'

export const jwtDecoderTool: Tool = {
  id: 'jwt-decoder',
  name: 'JWT Decoder',
  tagline: 'Decode a JWT to read its header and payload.',
  description:
    'Paste a JSON Web Token to decode its header and payload into readable JSON, with expiry and issued-at timestamps translated to local time. Decoding happens entirely in your browser — the token is never sent anywhere (and, being local, the signature is not verified).',
  category: 'Developer',
  keywords: ['jwt', 'json web token', 'decode', 'token', 'auth', 'bearer', 'claims', 'رمز', 'توكن'],
  status: 'stable',
  Icon: TokenIcon,
  component: lazyTool(() => import('./JwtDecoderTool')),
  ar: {
    name: 'مفكّك رموز JWT',
    tagline: 'فُكّ رمز JWT لقراءة ترويسته وحمولته.',
    description:
      'الصق رمز JSON Web Token لفكّ ترويسته وحمولته إلى JSON مقروء، مع تحويل أوقات الانتهاء والإصدار إلى التوقيت المحلي. يتم الفكّ بالكامل في متصفحك — لا يُرسل الرمز إلى أي مكان (ولأنه محلي، لا يُتحقَّق من التوقيع).',
  },
}
