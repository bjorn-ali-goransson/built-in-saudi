import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ShieldIcon } from '../../components/icons'

export const certDecoderTool: Tool = {
  id: 'cert-decoder',
  name: 'Certificate Decoder',
  nameAr: 'فاحص الشهادات',
  tagline: 'Read an SSL certificate — who, what, until when.',
  description:
    'Paste a PEM certificate and read what is actually in it: who it was issued to and by, when it expires and in how many days, the key and signature algorithms, every hostname it covers, its extensions and its SHA-256 fingerprint. Decoded in your browser by a small ASN.1 parser — nothing is uploaded, and no online checker sees your certificate.',
  category: 'Developer',
  keywords: [
    'certificate', 'ssl', 'tls', 'x509', 'pem', 'crt', 'cer', 'decoder', 'fingerprint', 'expiry', 'san', 'https',
    'شهادة', 'تشفير', 'انتهاء', 'بصمة', 'فحص', 'أمان',
  ],
  status: 'stable',
  Icon: ShieldIcon,
  component: lazyTool(() => import('./CertDecoderTool')),
  ar: {
    name: 'فاحص الشهادات',
    tagline: 'اقرأ شهادة SSL — لمن، وماذا، وإلى متى.',
    description:
      'الصق شهادة بصيغة PEM واقرأ ما فيها فعلًا: لمن صدرت ومن أصدرها، ومتى تنتهي وكم بقي لها، وخوارزميتَي المفتاح والتوقيع، وكل اسم نطاق تغطيه، وامتداداتها وبصمة SHA-256. تُفك في متصفحك عبر محلّل ASN.1 صغير — فلا يُرفع شيء، ولا يطّلع فاحص إلكتروني على شهادتك.',
  },
}
