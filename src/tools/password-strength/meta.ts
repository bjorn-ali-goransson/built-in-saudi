import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { LockIcon } from '../../components/icons'

export const passwordStrengthTool: Tool = {
  id: 'password-strength',
  name: 'Password Strength',
  nameAr: 'قوة كلمة المرور',
  tagline: 'How long would yours really take to crack?',
  description:
    'Check a password honestly. Raw character-set entropy flatters a password like Password123! — so this starts there and then penalises what actually makes one guessable: common words, keyboard walks, runs, repeats, years and the Capital-word-digits-symbol shape that cracking rules expand first. Nothing you type leaves the page; this tool makes no network requests at all.',
  category: 'Text',
  // The EVALUATIVE words were missing, which is what a checker is asked for.
  // Nobody types "entropy"; they type "is my password good / safe / weak", and
  // the generator was winning those on nothing but a scattered subsequence.
  keywords: [
    // Deliberately NOT 'how strong': it outscored the generator on "strong
    // password", which is the generator's query. The evaluative words that do
    // not collide with a twin are the ones worth having.
    'password', 'strength', 'good', 'safe', 'weak', 'check password', 'test password',
    'entropy', 'crack time', 'security',
    'كلمة المرور', 'قوة', 'قوية', 'ضعيفة', 'آمنة', 'فحص', 'أمان', 'اختراق', 'تخمين', 'مسربة', 'تسريب', 'مسرب',
  ],
  status: 'stable',
  Icon: LockIcon,
  component: lazyTool(() => import('./PasswordStrengthTool')),
  ar: {
    name: 'قوة كلمة المرور',
    tagline: 'كم يستغرق كسر كلمة مرورك فعلًا؟',
    description:
      'افحص كلمة مرورك بصدق. حساب العشوائية من مجموعة المحارف وحده يجامل كلمة مثل Password123!‎ — لذا تبدأ الأداة من هناك ثم تخصم ما يجعلها فعلًا قابلة للتخمين: الكلمات الشائعة، ومسارات لوحة المفاتيح، والتسلسلات، والتكرار، والسنوات، ونمط «حرف كبير + كلمة + أرقام + رمز» الذي توسّعه قواعد الكسر أولًا. لا يغادر ما تكتبه الصفحة؛ ولا ترسل هذه الأداة أي طلب شبكة إطلاقًا.',
  },
}
