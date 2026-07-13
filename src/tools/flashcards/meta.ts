import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CardsIcon } from '../../components/icons'

export const flashcardsTool: Tool = {
  id: 'flashcards',
  name: 'Flashcards',
  tagline: 'Make and study flip-card decks.',
  description:
    'Build a deck of flip cards — a prompt on the front, the answer on the back — then study it: flip, go through in order or shuffled. Your deck is saved in this browser, with no account and nothing uploaded.',
  category: 'Text',
  keywords: ['flashcards', 'study', 'memory', 'revision', 'deck', 'learn', 'بطاقات', 'مذاكرة', 'حفظ'],
  status: 'stable',
  Icon: CardsIcon,
  component: lazyTool(() => import('./FlashcardsTool')),
  ar: {
    name: 'البطاقات التعليمية',
    tagline: 'أنشئ وذاكِر مجموعات بطاقات قابلة للقلب.',
    description:
      'ابنِ مجموعة بطاقات قابلة للقلب — سؤال في الوجه وإجابة في الظهر — ثم ذاكِرها: اقلب، وتنقّل بالترتيب أو بالخلط. تُحفظ مجموعتك في هذا المتصفح، بلا حساب ودون رفع أي شيء.',
  },
}
