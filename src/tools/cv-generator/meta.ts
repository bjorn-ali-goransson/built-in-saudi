import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CvIcon } from '../../components/icons'

// Tool id renamed cv-generator → ats-cv-optimizer (the old /apps/cv-generator URL
// 301-redirects via router.tsx). The folder stays cv-generator/ to avoid churn,
// same as book-me keeping the book-with-me/ folder.
export const cvGeneratorTool: Tool = {
  id: 'ats-cv-optimizer',
  name: 'ATS CV Optimizer',
  nameAr: 'محسِّن السيرة الذاتية (ATS)',
  tagline: 'Score your CV for ATS and optimize it for the 10-second scan.',
  description:
    'Upload your existing CV and get it rewritten into a clean, ATS-ready résumé — signal only, no noise — then see how it scores across six ATS dimensions on a spider chart. The tool asks the few questions only you can answer and folds your replies back in to raise the score. Photos, colours, GPAs, references and month-level dates are stripped; skills and a punchy summary are synthesised from your whole history, key terms bolded. Export as PDF or Word. Sign-in with Google keeps it free and abuse-free.',
  category: 'Business',
  keywords: [
    'cv', 'resume', 'résumé', 'cv optimizer', 'ats cv optimizer', 'resume optimizer', 'cv checker',
    'ats', 'ats checker', 'ats score', 'cv generator', 'resume builder', 'job', 'career', 'pdf', 'word',
    'سيرة ذاتية', 'سيرة', 'ريزيومي', 'محسن السيرة', 'تحسين السيرة', 'أنظمة التتبع', 'منشئ السيرة', 'وظيفة', 'توظيف',
  ],
  status: 'stable',
  Icon: CvIcon,
  component: lazyTool(() => import('./CvGeneratorTool')),
  ar: {
    name: 'محسِّن السيرة الذاتية (ATS)',
    tagline: 'قيّم سيرتك لأنظمة التتبّع وحسّنها لمسح المجنِّد في ١٠ ثوانٍ.',
    description:
      'ارفع سيرتك الحالية واحصل عليها معادةَ الكتابة في قالب نظيف متوافق مع أنظمة التتبّع — إشارة فقط بلا ضجيج — ثم شاهد تقييمها عبر ست ركائز في مخطط عنكبوتي. تسألك الأداة عمّا لا يعرفه سواك وتدمج إجاباتك لرفع التقييم. تُزال الصور والألوان والمعدّلات والمراجع وتواريخ الأشهر؛ وتُستخلص المهارات وملخّص موجز من تاريخك كلّه مع إبراز الكلمات المهمة. صدّرها PDF أو Word. تسجيل الدخول بجوجل يبقيها مجانية وآمنة.',
  },
}
