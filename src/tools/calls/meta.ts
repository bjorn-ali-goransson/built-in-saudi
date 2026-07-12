import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { VideoCallIcon } from '../../components/icons'

export const callsTool: Tool = {
  id: 'calls',
  name: 'Private Call',
  nameAr: 'مكالمة خاصة',
  tagline: 'A peer-to-peer meeting — the call never touches a server.',
  description:
    'Start a private video call by sharing one invite image (QR + link). Video, screen-share, a shared whiteboard, chat and file-drop go straight between browsers over WebRTC — only the initial handshake touches a tiny relay, and it never sees your call. Uses public STUN, no recording, small groups. Some strict networks can’t connect without a relay (out of scope).',
  category: 'Communication',
  keywords: ['call', 'video call', 'meeting', 'p2p', 'peer to peer', 'webrtc', 'whiteboard', 'screen share', 'private', 'مكالمة', 'اجتماع', 'فيديو', 'سبورة', 'مشاركة الشاشة'],
  status: 'beta',
  Icon: VideoCallIcon,
  component: lazyTool(() => import('./CallsTool')),
  ar: {
    name: 'مكالمة خاصة',
    tagline: 'اجتماع مباشر بين الأجهزة — لا تمر المكالمة بأي خادم.',
    description:
      'ابدأ مكالمة فيديو خاصة بمشاركة صورة دعوة واحدة (رمز QR + رابط). الفيديو ومشاركة الشاشة والسبورة المشتركة والدردشة وإرسال الملفات تنتقل مباشرة بين المتصفحات عبر WebRTC — فقط المصافحة الأولى تمر بمُرحِّل صغير لا يرى مكالمتك أبدًا. يستخدم STUN عامًا، بلا تسجيل، لمجموعات صغيرة. بعض الشبكات الصارمة قد لا تتصل دون مُرحِّل (خارج النطاق).',
  },
}
