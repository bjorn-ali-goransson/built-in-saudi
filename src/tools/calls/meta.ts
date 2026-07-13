import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { VideoCallIcon } from '../../components/icons'

export const callsTool: Tool = {
  id: 'calls',
  name: 'Call',
  nameAr: 'مكالمة',
  tagline: 'Secure peer-to-peer voice, video and screen-share — no server.',
  description:
    'Secure peer-to-peer voice/video/teams calling between browsers - no data touches our servers. Share one invite link and let people in from a waiting room; video, screen-share, a shared whiteboard, chat and file-drop all go straight between browsers over WebRTC, with only the initial handshake passing through a tiny relay that never sees your call. Public STUN, no recording, small groups.',
  category: 'Communication',
  keywords: ['call', 'video call', 'meeting', 'p2p', 'peer to peer', 'webrtc', 'whiteboard', 'screen share', 'private', 'مكالمة', 'اجتماع', 'فيديو', 'سبورة', 'مشاركة الشاشة'],
  status: 'beta',
  Icon: VideoCallIcon,
  component: lazyTool(() => import('./CallsTool')),
  ar: {
    name: 'مكالمة',
    tagline: 'مكالمات صوت وفيديو ومشاركة شاشة آمنة بين الأجهزة — بلا خادم.',
    description:
      'مكالمات صوت وفيديو وفرق آمنة بين المتصفحات مباشرةً — لا تمر أي بيانات بخوادمنا. شارك رابط دعوة واحدًا واسمح للناس بالدخول من غرفة انتظار؛ الفيديو ومشاركة الشاشة والسبورة المشتركة والدردشة وإرسال الملفات تنتقل مباشرة بين المتصفحات عبر WebRTC، وفقط المصافحة الأولى تمر بمُرحِّل صغير لا يرى مكالمتك أبدًا. يستخدم STUN عامًا، بلا تسجيل، لمجموعات صغيرة.',
  },
}
