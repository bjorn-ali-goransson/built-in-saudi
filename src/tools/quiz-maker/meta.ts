import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { QuizIcon } from '../../components/icons'

export const quizMakerTool: Tool = {
  id: 'quiz-maker',
  name: 'Quiz Maker',
  nameAr: 'صانع الاختبارات',
  tagline: 'Print it, or share a link that stores nothing.',
  description:
    'Write a quiz — multiple choice, true/false and short answer — then print it as a question paper with a separate answer key, or share a link that anyone can take in their browser. The link carries the whole quiz after the # in the URL, and a fragment is never sent to a server: nothing is stored, there is no account, and there is nothing for us to lose. Runs entirely in your browser.',
  category: 'Generators',
  keywords: [
    'quiz', 'test', 'exam', 'questions', 'multiple choice', 'true false', 'teacher', 'classroom', 'printable', 'answer key', 'share',
    'اختبار', 'أسئلة', 'امتحان', 'اختيار من متعدد', 'صح خطأ', 'معلم', 'صف', 'طباعة', 'إجابات', 'مشاركة',
  ],
  status: 'stable',
  Icon: QuizIcon,
  component: lazyTool(() => import('./QuizMakerTool')),
  ar: {
    name: 'صانع الاختبارات',
    tagline: 'اطبعه، أو شارك رابطًا لا يخزّن شيئًا.',
    description:
      'اكتب اختبارًا — اختيار من متعدد وصح/خطأ وإجابة قصيرة — ثم اطبعه ورقة أسئلة مع ورقة إجابات منفصلة، أو شارك رابطًا يستطيع أي أحد أداءه في متصفحه. يحمل الرابط الاختبار كاملًا بعد علامة # في العنوان، وما بعد هذه العلامة لا يُرسل إلى خادم أبدًا: فلا شيء مخزّن، ولا حساب، ولا شيء لدينا لنفقده. يعمل داخل متصفحك بالكامل.',
  },
}
