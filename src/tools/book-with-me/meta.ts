import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CalendarCheckIcon } from '../../components/icons'

export const bookWithMeTool: Tool = {
  id: 'book-with-me',
  name: 'Book With Me',
  nameAr: 'احجز معي',
  tagline: 'Share one link; let people self-book a meeting.',
  description:
    'A free, no-sign-up scheduling link — paint your weekly availability, set the meeting length (45 min by default) with gaps and buffers, and share one link. People pick an open slot without the email back-and-forth; you get a push, a Telegram DM and an email when they book.',
  category: 'Business',
  keywords: [
    'calendly', 'booking', 'meeting', 'schedule', 'appointment', 'availability', 'calendar',
    'book a meeting', 'حجز', 'اجتماع', 'موعد', 'جدولة', 'رابط حجز', 'كالندلي',
  ],
  status: 'beta',
  Icon: CalendarCheckIcon,
  component: lazyTool(() => import('./BookWithMeTool')),
  ar: {
    name: 'احجز معي',
    tagline: 'شارك رابطًا واحدًا؛ ودَع الناس يحجزون معك.',
    description:
      'رابط جدولة مجاني بلا تسجيل — ارسم أوقات فراغك الأسبوعية، وحدِّد مدة الاجتماع (٤٥ دقيقة افتراضيًا) بفواصل ومهل، وشارك رابطًا واحدًا. يختار الناس وقتًا متاحًا دون تبادل رسائل، وتصلك إشعارات ورسالة تيليجرام وبريد عند الحجز.',
  },
}
