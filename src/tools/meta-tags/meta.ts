import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TagIcon } from '../../components/icons'

export const metaTagsTool: Tool = {
  id: 'meta-tags',
  name: 'Meta Tag Generator',
  tagline: 'SEO, Open Graph and Twitter tags for your page.',
  description:
    'Fill in a page’s title, description, URL and preview image to generate the full set of SEO, Open Graph and Twitter Card meta tags — with a live social-share preview — ready to paste into your <head>. Runs entirely in your browser.',
  category: 'Developer',
  keywords: ['meta tags', 'seo', 'open graph', 'og', 'twitter card', 'social', 'head', 'وسوم', 'سيو', 'أوبن غراف'],
  status: 'stable',
  Icon: TagIcon,
  component: lazyTool(() => import('./MetaTagsTool')),
  ar: {
    name: 'مولّد وسوم Meta',
    tagline: 'وسوم SEO وOpen Graph وتويتر لصفحتك.',
    description:
      'أدخل عنوان الصفحة ووصفها ورابطها وصورة المعاينة لتوليد مجموعة وسوم SEO وOpen Graph وبطاقة تويتر كاملة — مع معاينة حيّة للمشاركة — جاهزة للّصق في <head>. تعمل بالكامل في متصفحك.',
  },
}
