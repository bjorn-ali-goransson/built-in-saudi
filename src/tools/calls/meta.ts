import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { VideoCallIcon } from '../../components/icons'

export const callsTool: Tool = {
  id: 'calls',
  name: 'Calls',
  nameAr: 'مكالمات',
  tagline: 'Secure peer-to-peer voice, video and screen-share — no app, no account.',
  description:
    'Secure peer-to-peer voice/video/teams calling between browsers, end-to-end encrypted. Share one invite link and let people in from a waiting room; video, screen-share, a shared whiteboard, chat and file-drop all go straight between browsers over WebRTC. When a network blocks that, the voice goes through our relay, which carries the encrypted call and cannot hear it. No recording on our side, small groups.',
  category: 'Communication',
  keywords: ['call', 'video call', 'meeting', 'p2p', 'peer to peer', 'webrtc', 'whiteboard', 'screen share', 'private', 'مكالمة', 'اجتماع', 'فيديو', 'سبورة', 'مشاركة الشاشة'],
  status: 'stable',
  Icon: VideoCallIcon,
  component: lazyTool(() => import('./CallsTool')),
  ar: {
    name: 'مكالمات',
    tagline: 'مكالمات صوت وفيديو ومشاركة شاشة آمنة بين الأجهزة — بلا تطبيق وبلا حساب.',
    description:
      'مكالمات صوت وفيديو وفرق آمنة بين المتصفحات، مشفّرة من طرف إلى طرف. شارك رابط دعوة واحدًا واسمح للناس بالدخول من غرفة انتظار؛ الفيديو ومشاركة الشاشة والسبورة المشتركة والدردشة وإرسال الملفات تنتقل مباشرة بين المتصفحات عبر WebRTC. وإن منعت الشبكة ذلك يمرّ الصوت عبر خادم الترحيل لدينا، فينقل المكالمة المشفّرة ولا يستطيع سماعها. بلا تسجيل من جهتنا، لمجموعات صغيرة.',
  },
}
