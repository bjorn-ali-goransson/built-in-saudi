import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { LinkIcon } from '../../components/icons'

export const urlParserTool: Tool = {
  id: 'url-parser',
  name: 'URL Parser & Builder',
  nameAr: 'محلّل الروابط ومحرّرها',
  tagline: 'Pull a URL apart, edit the query, put it back.',
  description:
    'Break a URL into its scheme, host, port, path, fragment and query parameters, edit any of them, and get a correctly-encoded URL back — without hand-counting ampersands or guessing at percent-encoding. It also spots tracking parameters (utm_*, gclid, fbclid and friends) and strips them in one click, and flags a hostname using non-ASCII characters. A second mode encodes and decodes text for URLs (percent-encoding, whole URL or one component) and HTML entities, both directions, as you type.',
  category: 'Developer',
  keywords: [
    'url', 'parser', 'query string', 'parameters', 'utm', 'encode', 'link', 'رابط', 'معاملات', 'تحليل', 'ترميز', 'تتبع',
    // Merged in from the URL & HTML Encoder (November 2026).
    'url encode', 'url decode', 'percent encoding', 'html entities', 'escape', 'uri',
  ],
  aliases: ['URL & HTML Encoder', 'مُرمِّز الروابط وHTML'],
  status: 'stable',
  Icon: LinkIcon,
  component: lazyTool(() => import('./UrlParserTool')),
  ar: {
    name: 'محلّل الروابط ومحرّرها',
    tagline: 'فكّك رابطًا وعدّل معاملاته وأعد بناءه.',
    description:
      'فكّك رابطًا إلى بروتوكوله ومضيفه ومنفذه ومساره وجزئه ومعاملاته، وعدّل أيًّا منها، ثم احصل على رابط مُرمّز بشكل صحيح — دون عدّ علامات & يدويًا أو التخمين في الترميز. وتكشف الأداة معاملات التتبّع (‎utm_*‎ وgclid وfbclid وأمثالها) وتزيلها بنقرة، وتنبّهك إلى اسم مضيف بمحارف غير لاتينية. وفي وضع ثانٍ ترمّز النص للروابط (ترميز النسبة المئوية لرابط كامل أو لجزء منه) ولكيانات HTML وتفكّ ترميزه، في الاتجاهين، أثناء الكتابة.',
  },
}
