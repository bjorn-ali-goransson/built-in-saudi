import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { GitIcon } from '../../components/icons'

export const gitignoreTool: Tool = {
  id: 'gitignore',
  name: '.gitignore Generator',
  tagline: 'Combine .gitignore rules for your stack.',
  description:
    'Pick the languages, tools and editors you use and get a combined .gitignore with the usual build artefacts, dependency folders and OS/editor cruft — ready to copy or download. Runs entirely in your browser.',
  category: 'Developer',
  keywords: ['gitignore', 'git', 'ignore', 'node', 'python', 'template', 'repository', 'جيت', 'تجاهل'],
  status: 'stable',
  Icon: GitIcon,
  component: lazyTool(() => import('./GitignoreTool')),
  ar: {
    name: 'مولّد .gitignore',
    tagline: 'ادمج قواعد .gitignore حسب أدواتك.',
    description:
      'اختر اللغات والأدوات والمحرّرات التي تستخدمها لتحصل على ملف .gitignore مدمج يشمل مخرجات البناء ومجلّدات الاعتماديات وفوضى النظام والمحرّر — جاهز للنسخ أو التنزيل. يعمل بالكامل في متصفحك.',
  },
}
