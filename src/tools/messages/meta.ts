import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ChatIcon } from '../../components/icons'

export const messagesTool: Tool = {
  id: 'messages',
  name: 'Messages',
  nameAr: 'الرسائل',
  tagline: 'Private team chat that lives in your browser — direct, end-to-end encrypted.',
  description:
    'Teams-style messaging, one-to-one and in groups, that goes straight between browsers. Replies, reactions, edits, polls, voice notes, files of any size, locations, pinned and starred messages, scheduled and disappearing messages, read receipts and typing — with your chats stored only in this browser. When someone is away, the message waits as a notification sealed with a key only your two devices hold. Call anyone from a chat with one tap.',
  category: 'Communication',
  keywords: ['messages', 'chat', 'messenger', 'team chat', 'group chat', 'direct message', 'end to end encrypted', 'private messaging', 'send files', 'voice note', 'poll', 'whatsapp alternative', 'teams alternative', 'slack alternative', 'رسائل', 'دردشة', 'محادثة', 'مجموعة', 'رسالة صوتية', 'مراسلة', 'تشفير'],
  status: 'beta',
  Icon: ChatIcon,
  component: lazyTool(() => import('./MessagesTool')),
  ar: {
    name: 'الرسائل',
    tagline: 'دردشة فريق خاصة تعيش في متصفحك — مباشرة ومشفّرة من طرف إلى طرف.',
    description:
      'مراسلة على طريقة Teams، فردية وفي مجموعات، تنتقل مباشرة بين المتصفحات. ردود وتفاعلات وتعديلات وتصويتات ورسائل صوتية وملفات بأي حجم ومواقع ورسائل مثبّتة ومميّزة بنجمة ورسائل مجدولة ومؤقتة وإشعارات قراءة ومؤشر كتابة — ومحادثاتك محفوظة في هذا المتصفح فقط. وعندما يكون الطرف الآخر غير متصل تنتظره الرسالة كإشعار مختوم بمفتاح لا يملكه إلا جهازاكما. اتصل بأي شخص من المحادثة بضغطة واحدة.',
  },
}
