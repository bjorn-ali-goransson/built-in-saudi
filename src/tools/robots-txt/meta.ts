import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { RobotIcon } from '../../components/icons'

export const robotsTxtTool: Tool = {
  id: 'robots-txt',
  name: 'robots.txt Generator',
  tagline: 'Build a robots.txt with the right rules.',
  description:
    'Generate a valid robots.txt: allow or block crawlers, add disallowed paths, set a crawl-delay and point to your sitemap — then copy or download the file. Runs entirely in your browser.',
  category: 'Developer',
  keywords: ['robots.txt', 'crawler', 'seo', 'user-agent', 'disallow', 'sitemap', 'روبوتس', 'زواحف', 'سيو'],
  status: 'stable',
  Icon: RobotIcon,
  component: lazyTool(() => import('./RobotsTxtTool')),
  ar: {
    name: 'مولّد robots.txt',
    tagline: 'أنشئ ملف robots.txt بالقواعد الصحيحة.',
    description:
      'ولّد ملف robots.txt صالحًا: اسمح أو امنع الزواحف، وأضِف مسارات ممنوعة، وحدّد مهلة الزحف، وأشِر إلى خريطة موقعك — ثم انسخ الملف أو نزّله. يعمل بالكامل في متصفحك.',
  },
}
