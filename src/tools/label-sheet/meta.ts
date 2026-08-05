import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { GridIcon } from '../../components/icons'

export const labelSheetTool: Tool = {
  id: 'label-sheet',
  name: 'Label Sheets',
  nameAr: 'أوراق الملصقات',
  tagline: 'Address and name labels, and it can start mid-sheet.',
  description:
    'Print a list onto a sheet of adhesive labels — addresses, names, asset tags — on the common A4 and US Letter stocks, at their published measurements. The part other generators leave out: you can start at any label position, so a sheet with twelve left on it is not wasted. Arabic names are shaped and laid out correctly.',
  category: 'Generators',
  keywords: ['labels', 'address labels', 'avery', 'stickers', 'print', 'sheet', 'ملصقات', 'عناوين', 'طباعة', 'لاصق', 'أسماء'],
  status: 'stable',
  Icon: GridIcon,
  component: lazyTool(() => import('./LabelSheetTool')),
  ar: {
    name: 'مولّد أوراق الملصقات',
    tagline: 'ملصقات عناوين وأسماء، ويمكن أن تبدأ من منتصف الورقة.',
    description:
      'اطبع قائمة على ورقة ملصقات لاصقة — عناوين أو أسماء أو وسوم أصول — على مقاسات A4 وLetter الشائعة وبمقاييسها المنشورة. والجزء الذي تغفله المولّدات الأخرى: يمكنك البدء من أي موضع ملصق، فلا تُهدر ورقة بقي فيها اثنا عشر ملصقًا. وتُشكَّل الأسماء العربية وتُرتَّب بشكل صحيح.',
  },
}
