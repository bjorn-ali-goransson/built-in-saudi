import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TextIcon } from '../../components/icons'

export const nameSpellingTool: Tool = {
  id: 'name-spelling',
  name: 'Name in English Letters',
  nameAr: 'كتابة الاسم بالإنجليزية',
  tagline: 'Mohammed, Muhammad or Mohamed — see the options.',
  description:
    'Write an Arabic name in Latin letters, one part at a time, choosing between the spellings that actually appear on documents here. There is no correct answer — محمد is Mohammed, Muhammad, Mohamed, Mohammad and Muhammed on five passports in the same family — so this shows the options rather than pretending to a verdict, and tells you to copy your passport if you already have one.',
  category: 'Saudi / Local',
  keywords: [
    'name', 'transliteration', 'spelling', 'english', 'passport', 'romanisation', 'arabic name', 'ticket', 'booking',
    'اسم', 'كتابة', 'إنجليزي', 'جواز', 'تهجئة', 'حجز', 'تذكرة', 'اسم عربي',
  ],
  status: 'stable',
  Icon: TextIcon,
  component: lazyTool(() => import('./NameSpellingTool')),
  ar: {
    name: 'كتابة الاسم بالإنجليزية',
    tagline: 'Mohammed أم Muhammad أم Mohamed — اطّلع على الخيارات.',
    description:
      'اكتب اسمًا عربيًا بحروف لاتينية، جزءًا جزءًا، مختارًا بين الكتابات التي تظهر فعلًا في الوثائق هنا. ولا جواب صحيح واحد — فمحمد تُكتب Mohammed وMuhammad وMohamed وMohammad وMuhammed في خمسة جوازات لأسرة واحدة — ولذلك تعرض الأداة الخيارات ولا تدّعي حكمًا، وتنصحك بنسخ جوازك إن كان لديك واحد.',
  },
}
