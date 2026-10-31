import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { LinkIcon } from '../../components/icons'

export const linkShortenerTool: Tool = {
  id: 'link-shortener',
  name: 'Link Shortener',
  nameAr: 'اختصار الروابط',
  tagline: 'Turn long URLs into tidy built-in-saudi.com/s/… links.',
  description:
    'Shorten any long link into a clean built-in-saudi.com/s/… URL you can share anywhere. Sign in with Google to create and manage your links and see their click counts. Each link is kept for 6 months. Free, no ads, no tracking beyond a simple click tally.',
  category: 'Developer',
  keywords: [
    'link shortener', 'url shortener', 'short link', 'shorten url', 'short url', 'tinyurl', 'link',
    'اختصار الروابط', 'رابط قصير', 'مختصر روابط', 'اختصار رابط',
  ],
  status: 'beta',
  Icon: LinkIcon,
  component: lazyTool(() => import('./LinkShortenerTool')),
  ar: {
    name: 'اختصار الروابط',
    tagline: 'حوّل الروابط الطويلة إلى روابط قصيرة أنيقة.',
    description:
      'اختصر أي رابط طويل إلى رابط نظيف على built-in-saudi.com/s/… تشاركه في أي مكان. سجّل الدخول بحساب Google لإنشاء روابطك وإدارتها ورؤية عدد النقرات. يُحفظ كل رابط لمدة ٦ أشهر. مجاني وبلا إعلانات.',
  },
}
