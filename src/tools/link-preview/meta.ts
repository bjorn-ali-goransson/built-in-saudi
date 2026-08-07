import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ShareIcon } from '../../components/icons'

export const linkPreviewTool: Tool = {
  id: 'link-preview',
  name: 'Link Preview Checker',
  nameAr: 'فاحص معاينة الروابط',
  tagline: 'See how your link will look when shared.',
  description:
    'Paste your page’s meta tags and see the card WhatsApp, X, LinkedIn and Facebook will actually render — then a list of what will go wrong: a missing og:image, a title that will be truncated, a relative image path crawlers will not resolve. Nothing is fetched: a browser cannot read another site’s HTML, and any tool that claims to is proxying your URL through its own server.',
  category: 'Web',
  keywords: ['open graph', 'og:image', 'link preview', 'social', 'twitter card', 'meta tags', 'share', 'معاينة الرابط', 'وسوم', 'مشاركة', 'سوشال'],
  status: 'stable',
  Icon: ShareIcon,
  component: lazyTool(() => import('./LinkPreviewTool')),
  ar: {
    name: 'فاحص معاينة الروابط',
    tagline: 'شاهد كيف سيظهر رابطك عند المشاركة.',
    description:
      'الصق وسوم صفحتك وشاهد البطاقة التي سيعرضها واتساب وإكس ولينكدإن وفيسبوك فعلًا — ثم قائمة بما سيختل: صورة og مفقودة، أو عنوان سيُقتطع، أو مسار صورة نسبي لن تحلّه الزواحف. لا يُجلب شيء: فالمتصفح لا يستطيع قراءة HTML موقع آخر، وأي أداة تدّعي ذلك ترسل رابطك عبر خادمها.',
  },
}
