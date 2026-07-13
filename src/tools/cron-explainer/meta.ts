import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ClockIcon } from '../../components/icons'

export const cronExplainerTool: Tool = {
  id: 'cron-explainer',
  name: 'Cron Explainer',
  tagline: 'Turn a cron expression into plain words and next run times.',
  description:
    'Paste a 5-field cron expression and get a plain-language description of when it runs, plus the next several run times in your local timezone. Supports ranges, steps and lists. Everything is computed in your browser.',
  category: 'Developer',
  keywords: ['cron', 'crontab', 'schedule', 'cron expression', 'next run', 'explain', 'كرون', 'جدولة'],
  status: 'stable',
  Icon: ClockIcon,
  component: lazyTool(() => import('./CronExplainerTool')),
  ar: {
    name: 'مفسّر Cron',
    tagline: 'حوّل تعبير cron إلى كلمات وأوقات تشغيل قادمة.',
    description:
      'الصق تعبير cron المكوَّن من خمسة حقول لتحصل على وصف واضح لموعد تشغيله، إضافةً إلى أوقات التشغيل القادمة بتوقيتك المحلي. يدعم النطاقات والخطوات والقوائم. كل الحسابات تجري في متصفحك.',
  },
}
