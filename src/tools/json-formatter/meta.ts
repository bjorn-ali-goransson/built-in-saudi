import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CodeIcon } from '../../components/icons'

export const jsonFormatterTool: Tool = {
  id: 'json-formatter',
  name: 'Code Formatter',
  nameAr: 'منسّق الكود',
  tagline: 'Prettify & minify JSON, CSS and XML.',
  description:
    'Format, minify and validate code in your browser — JSON (with a precise line/column error and sort-keys), plus CSS and XML beautify/minify. 2/4-space indent, copy or download. Nothing is uploaded, so pasted tokens and PII stay on your device.',
  category: 'Developer',
  keywords: ['json', 'css', 'xml', 'format', 'formatter', 'beautify', 'minify', 'validate', 'pretty print', 'منسق', 'تنسيق'],
  status: 'stable',
  Icon: CodeIcon,
  component: lazyTool(() => import('./JsonFormatterTool')),
  ar: {
    name: 'منسّق JSON',
    tagline: 'تنسيق وتصغير والتحقّق من JSON.',
    description:
      'نسّق وصغّر وتحقّق من JSON داخل متصفحك — مسافة ٢/٤، ترتيب المفاتيح، ورسالة خطأ دقيقة بالسطر والعمود عند وجود خطأ. انسخ أو نزّل الناتج. لا يُرفع شيء، فتبقى الرموز والبيانات على جهازك.',
  },
}
