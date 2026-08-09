import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { GridIcon } from '../../components/icons'

export const wordSearchTool: Tool = {
  id: 'word-search',
  name: 'Word Search Maker',
  nameAr: 'صانع البحث عن الكلمات',
  tagline: 'A printable puzzle from your own word list.',
  description:
    'Make a printable word search from your own list, in English or Arabic, with an answer key on a second page. Arabic works properly: the letters are matched the way a solver reads them, so alef in all its forms counts as one letter, and words run right to left. Every sheet carries a seed, so reprinting gives you the same puzzle your answer key belongs to. Drawn in your browser — the word list is never uploaded.',
  category: 'Generators',
  keywords: [
    'word search', 'wordsearch', 'puzzle', 'printable', 'classroom', 'teacher',
    'worksheet', 'game', 'kids', 'activity', 'answer key', 'arabic word search',
    'بحث عن الكلمات', 'كلمات متقاطعة', 'لغز', 'طباعة', 'معلم', 'صف', 'نشاط', 'أطفال', 'ورقة عمل',
  ],
  status: 'stable',
  Icon: GridIcon,
  component: lazyTool(() => import('./WordSearchTool')),
  ar: {
    name: 'صانع البحث عن الكلمات',
    tagline: 'لغز للطباعة من قائمة كلماتك.',
    description:
      'اصنع لعبة البحث عن الكلمات للطباعة من قائمتك، بالعربية أو الإنجليزية، مع ورقة حلّ في صفحة ثانية. والعربية تعمل كما ينبغي: تُطابَق الحروف كما يقرؤها الحلّال، فالألف بكل صورها حرف واحد، وتُقرأ الكلمات من اليمين إلى اليسار. وتحمل كل ورقة رمزًا، فإعادة الطباعة تعطيك اللغز نفسه الذي تخص ورقة الحل. يُرسم في متصفحك — ولا تُرفع قائمة الكلمات أبدًا.',
  },
}
