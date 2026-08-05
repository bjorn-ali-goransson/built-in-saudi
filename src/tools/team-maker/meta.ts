import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { UsersIcon } from '../../components/icons'

export const teamMakerTool: Tool = {
  id: 'team-maker',
  name: 'Random Team Maker',
  nameAr: 'مولّد الفرق العشوائي',
  tagline: 'Split a list of names into fair, random teams.',
  description:
    'Paste a list of names and split them into teams — by how many teams you want, or by how many people each should hold. You can name people to keep apart, and they will be placed on different teams where possible. The shuffle uses the browser’s cryptographic randomness with a proper Fisher-Yates, so every arrangement really is equally likely.',
  category: 'Generators',
  keywords: ['team', 'groups', 'random', 'split', 'classroom', 'shuffle', 'picker', 'فرق', 'مجموعات', 'توزيع', 'عشوائي', 'قرعة', 'صف'],
  status: 'stable',
  Icon: UsersIcon,
  component: lazyTool(() => import('./TeamMakerTool')),
  ar: {
    name: 'مولّد الفرق العشوائي',
    tagline: 'وزّع قائمة أسماء على فرق عادلة وعشوائية.',
    description:
      'الصق قائمة أسماء ووزّعها على فرق — بعدد الفرق التي تريدها أو بعدد الأفراد في كل فريق. ويمكنك تسمية من تريد الفصل بينهم فيوضعون في فرق مختلفة قدر الإمكان. يستخدم الخلط عشوائية المتصفح التعموية بخوارزمية فيشر-ييتس الصحيحة، فيكون كل ترتيب محتملًا بالتساوي فعلًا.',
  },
}
