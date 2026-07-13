import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { KanbanIcon } from '../../components/icons'

export const kanbanTool: Tool = {
  id: 'kanban',
  name: 'Kanban Board',
  tagline: 'A simple to-do / doing / done board.',
  description:
    'A lightweight personal Kanban board — add cards to To-do, Doing and Done and move them across as work progresses. The whole board is saved in this browser, with no account and nothing uploaded.',
  category: 'Text',
  keywords: ['kanban', 'board', 'todo', 'tasks', 'productivity', 'trello', 'لوحة', 'مهام', 'كانبان'],
  status: 'stable',
  Icon: KanbanIcon,
  component: lazyTool(() => import('./KanbanTool')),
  ar: {
    name: 'لوحة كانبان',
    tagline: 'لوحة بسيطة: للعمل / قيد التنفيذ / منجز.',
    description:
      'لوحة كانبان شخصية خفيفة — أضِف بطاقات إلى «للعمل» و«قيد التنفيذ» و«منجز» وانقلها مع تقدّم العمل. تُحفظ اللوحة كاملةً في هذا المتصفح، بلا حساب ودون رفع أي شيء.',
  },
}
