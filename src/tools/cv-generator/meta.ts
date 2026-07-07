import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CvIcon } from '../../components/icons'

export const cvGeneratorTool: Tool = {
  id: 'cv-generator',
  name: 'CV Generator',
  nameAr: 'منشئ السيرة الذاتية',
  tagline: 'Rebuild your CV for the 10-second recruiter scan.',
  description:
    'Upload your existing CV and get it rewritten into a clean, ATS-ready résumé — signal only, no noise. Photos, colours, GPAs, references and month-level dates are stripped; skills and a punchy summary are synthesised from your whole history, key terms bolded. Export as PDF or Word. Sign-in with Google keeps it free and abuse-free.',
  category: 'Business',
  keywords: [
    'cv', 'resume', 'résumé', 'cv generator', 'resume builder', 'ats', 'job', 'career', 'pdf', 'word',
    'سيرة ذاتية', 'سيرة', 'ريزيومي', 'منشئ السيرة', 'وظيفة', 'توظيف',
  ],
  status: 'stable',
  Icon: CvIcon,
  component: lazyTool(() => import('./CvGeneratorTool')),
  ar: {
    name: 'منشئ السيرة الذاتية',
    tagline: 'أعِد بناء سيرتك لمسح المجنِّد في ١٠ ثوانٍ.',
    description:
      'ارفع سيرتك الحالية واحصل عليها معادةَ الكتابة في قالب نظيف متوافق مع أنظمة التتبّع — إشارة فقط بلا ضجيج. تُزال الصور والألوان والمعدّلات والمراجع وتواريخ الأشهر؛ وتُستخلص المهارات وملخّص موجز من تاريخك كلّه مع إبراز الكلمات المهمة. صدّرها PDF أو Word. تسجيل الدخول بجوجل يبقيها مجانية وآمنة.',
  },
}
