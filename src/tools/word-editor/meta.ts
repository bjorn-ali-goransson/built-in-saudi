import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { DocumentEditIcon } from '../../components/icons'

export const wordEditorTool: Tool = {
  id: 'word-editor',
  name: 'Document Editor',
  nameAr: 'محرر المستندات',
  tagline: 'Open, edit and save Word documents in your browser — styles, tables, pictures and live co-writing.',
  description:
    'A word processor that runs entirely in your browser. Open .docx, .odt, Markdown, HTML and text files, write with headings, numbered and bulleted lists, checklists, tables with merged cells, pictures, links, footnotes, page breaks, headers and footers, in Arabic and English side by side, then save back to the same file or download it as Word, Markdown or a web page. Documents are kept in this browser, never uploaded. Invite others to write with you live, browser to browser, with you as the owner whose copy is the truth.',
  category: 'Office',
  keywords: [
    // Merged in November 2026 from the tools this one replaced.
    'markdown to word', 'word to markdown', 'docx to text', 'word to text', 'markdown to html', 'html to markdown', 'markdown', 'ماركداون', 'وورد إلى نص','word', 'docx', 'word editor', 'edit word online', 'open docx', 'word online free', 'word processor', 'document editor', 'odt', 'write a document', 'write a letter', 'collaborative document', 'وورد', 'ورد', 'تعديل ملف وورد', 'فتح ملف docx', 'محرر نصوص', 'معالج نصوص', 'كتابة مستند', 'كتابة خطاب'],
  status: 'beta',
  Icon: DocumentEditIcon,
  component: lazyTool(() => import('./WordEditorTool')),
  ar: {
    name: 'محرر المستندات',
    tagline: 'افتح مستندات وورد وعدّلها واحفظها في متصفحك — أنماط وجداول وصور وكتابة مشتركة مباشرة.',
    description:
      'معالج نصوص يعمل بالكامل في متصفحك. افتح ملفات ‎.docx و‎.odt وMarkdown وHTML والنصوص، واكتب بعناوين وقوائم مرقمة ونقطية وقوائم مهام وجداول بخلايا مدمجة وصور وروابط وحواشٍ وفواصل صفحات ورأس وتذييل، بالعربية والإنجليزية جنبًا إلى جنب، ثم احفظ في الملف نفسه أو نزّله بصيغة وورد أو Markdown أو صفحة ويب. تبقى المستندات في هذا المتصفح ولا تُرفع. ادعُ آخرين للكتابة معك مباشرة من متصفح إلى متصفح، وأنت المالك الذي نسخته هي المرجع.',
  },
}
