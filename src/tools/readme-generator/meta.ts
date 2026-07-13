import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { MarkdownIcon } from '../../components/icons'

export const readmeGeneratorTool: Tool = {
  id: 'readme-generator',
  name: 'README Generator',
  tagline: 'Draft a tidy project README in Markdown.',
  description:
    'Fill in your project’s name, description, features, install and usage steps and licence to generate a clean, well-structured README.md — with a live preview of the Markdown — ready to copy or download. Runs entirely in your browser.',
  category: 'Developer',
  keywords: ['readme', 'markdown', 'documentation', 'github', 'project', 'md', 'ريدمي', 'ماركداون', 'توثيق'],
  status: 'stable',
  Icon: MarkdownIcon,
  component: lazyTool(() => import('./ReadmeGeneratorTool')),
  ar: {
    name: 'مولّد README',
    tagline: 'اكتب ملف README مرتّبًا بصيغة Markdown.',
    description:
      'أدخل اسم مشروعك ووصفه ومزاياه وخطوات التثبيت والاستخدام والرخصة لتوليد ملف README.md نظيف ومنظّم — مع معاينة حيّة لصيغة Markdown — جاهز للنسخ أو التنزيل. يعمل بالكامل في متصفحك.',
  },
}
