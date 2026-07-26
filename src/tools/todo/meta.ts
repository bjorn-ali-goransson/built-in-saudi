import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ListIcon } from '../../components/icons'

export const todoTool: Tool = {
  id: 'todo',
  name: 'To-do Lists',
  nameAr: 'قوائم المهام',
  tagline: 'Checklists that stay on your device — or sync and share.',
  description:
    'Simple to-do lists that live in your browser: add, tick off, reorder and clear. No account needed and nothing is uploaded. If you want a list on more than one device — or shared with other people so you can tick things off together — sign in with Google and switch sync on for just that list. Everything else stays local.',
  category: 'Text',
  keywords: ['todo', 'to-do', 'task', 'tasks', 'checklist', 'list', 'shopping list', 'shared', 'productivity', 'مهام', 'قائمة', 'مشاركة', 'تسوق'],
  status: 'beta',
  Icon: ListIcon,
  component: lazyTool(() => import('./TodoTool')),
  ar: {
    name: 'قوائم المهام',
    tagline: 'قوائم تبقى على جهازك — أو زامِنها وشاركها.',
    description:
      'قوائم مهام بسيطة تعيش في متصفحك: أضِف وأنجِز ورتّب وامسح. بلا حساب ودون رفع أي شيء. وإن أردت قائمة على أكثر من جهاز — أو مشتركة مع آخرين لتنجزوا معًا — سجّل الدخول بحساب جوجل وفعّل المزامنة لتلك القائمة وحدها. وما عداها يبقى محليًا.',
  },
}
