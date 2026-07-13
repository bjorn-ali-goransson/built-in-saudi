import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { DeviceIcon } from '../../components/icons'

export const userAgentTool: Tool = {
  id: 'user-agent',
  name: 'User-Agent Parser',
  tagline: 'See the browser, engine and OS behind a UA string.',
  description:
    'Read your own browser’s user-agent string, or paste any other, and see the detected browser, rendering engine, operating system and device type broken out. Everything is parsed locally — your UA is never sent anywhere.',
  category: 'Developer',
  keywords: ['user agent', 'ua', 'browser', 'parser', 'os', 'engine', 'detect', 'وكيل المستخدم', 'متصفح'],
  status: 'stable',
  Icon: DeviceIcon,
  component: lazyTool(() => import('./UserAgentTool')),
  ar: {
    name: 'محلّل وكيل المستخدم',
    tagline: 'اعرف المتصفح والمحرّك ونظام التشغيل من نص UA.',
    description:
      'اقرأ نص وكيل المستخدم لمتصفحك، أو الصق أي نص آخر، لترى المتصفح المكتشَف ومحرّك العرض ونظام التشغيل ونوع الجهاز مفصّلة. كل التحليل محلي — لا يُرسل وكيلك إلى أي مكان.',
  },
}
