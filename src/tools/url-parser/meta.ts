import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { LinkIcon } from '../../components/icons'

export const urlParserTool: Tool = {
  id: 'url-parser',
  name: 'URL Parser & Builder',
  nameAr: 'محلّل الروابط ومحرّرها',
  tagline: 'Pull a URL apart, edit the query, put it back.',
  description:
    'Break a URL into its scheme, host, port, path, fragment and query parameters, edit any of them, and get a correctly-encoded URL back — without hand-counting ampersands or guessing at percent-encoding. It also spots tracking parameters (utm_*, gclid, fbclid and friends) and strips them in one click, and flags a hostname using non-ASCII characters.',
  category: 'Web',
  keywords: ['url', 'parser', 'query string', 'parameters', 'utm', 'encode', 'link', 'رابط', 'معاملات', 'تحليل', 'ترميز', 'تتبع'],
  status: 'stable',
  Icon: LinkIcon,
  component: lazyTool(() => import('./UrlParserTool')),
  ar: {
    name: 'محلّل الروابط ومحرّرها',
    tagline: 'فكّك رابطًا وعدّل معاملاته وأعد بناءه.',
    description:
      'فكّك رابطًا إلى بروتوكوله ومضيفه ومنفذه ومساره وجزئه ومعاملاته، وعدّل أيًّا منها، ثم احصل على رابط مُرمّز بشكل صحيح — دون عدّ علامات & يدويًا أو التخمين في الترميز. وتكشف الأداة معاملات التتبّع (‎utm_*‎ وgclid وfbclid وأمثالها) وتزيلها بنقرة، وتنبّهك إلى اسم مضيف بمحارف غير لاتينية.',
  },
}
