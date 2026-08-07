import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CalendarCheckIcon } from '../../components/icons'

export const icsBuilderTool: Tool = {
  id: 'ics-builder',
  name: 'Calendar File (.ics)',
  nameAr: 'ملف تقويم (‎.ics‎)',
  tagline: 'Make an event anyone can add — or read one.',
  description:
    'Build a calendar invite anyone can open in Apple Calendar, Outlook or Google, with repeats and a reminder — or paste an .ics you have been sent and see plainly what it says in your own timezone. Follows the parts of RFC 5545 that generators usually skip: lines folded at 75 octets, commas and semicolons escaped, and all-day events written as dates rather than midnight-to-midnight. Runs entirely in your browser.',
  category: 'Generators',
  keywords: [
    'ics', 'calendar', 'event', 'invite', 'vcalendar', 'vevent', 'outlook', 'apple calendar', 'google calendar', 'rfc 5545', 'reminder', 'recurring',
    'تقويم', 'حدث', 'دعوة', 'موعد', 'تذكير', 'تكرار', 'ملف تقويم',
  ],
  status: 'stable',
  Icon: CalendarCheckIcon,
  component: lazyTool(() => import('./IcsBuilderTool')),
  ar: {
    name: 'ملف تقويم (‎.ics‎)',
    tagline: 'أنشئ حدثًا يضيفه أي أحد — أو اقرأ حدثًا وصلك.',
    description:
      'أنشئ دعوة تقويم يفتحها أي أحد في Apple Calendar أو Outlook أو Google، مع التكرار والتذكير — أو الصق ملف ‎.ics‎ وصلك وشاهد بوضوح ما فيه بتوقيتك أنت. تلتزم الأداة بما تتخطاه المولّدات عادةً من معيار RFC 5545: طيّ الأسطر عند ٧٥ ثمانية، وتهريب الفواصل والفواصل المنقوطة، وكتابة أحداث اليوم الكامل تواريخَ لا من منتصف ليل إلى منتصف ليل. تعمل داخل متصفحك بالكامل.',
  },
}
