import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { MergeIcon } from '../../components/icons'

export const csvMergeTool: Tool = {
  id: 'csv-merge',
  name: 'CSV Merge & Join',
  nameAr: 'دمج ملفات CSV',
  tagline: 'Join two exports on a shared column, or stack them.',
  description:
    'Match two CSV exports on a column they share — an id, an email, an order number — and get one file with both sides’ data, told how many rows matched and how many found nothing. Or stack two files into one, aligned BY COLUMN NAME rather than by position, because positional stacking is what silently moves a phone number into the city column. Nothing is uploaded.',
  category: 'Developer',
  keywords: ['csv', 'merge', 'join', 'combine', 'vlookup', 'excel', 'spreadsheet', 'دمج', 'ربط', 'جداول', 'اكسل', 'بيانات'],
  status: 'stable',
  Icon: MergeIcon,
  component: lazyTool(() => import('./CsvMergeTool')),
  ar: {
    name: 'دمج وربط ملفات CSV',
    tagline: 'اربط تصديرين بعمود مشترك، أو ضعهما معًا.',
    description:
      'اربط تصديرَي CSV بعمود مشترك بينهما — معرّف أو بريد أو رقم طلب — لتحصل على ملف واحد يحمل بيانات الجانبين، مع إخبارك بعدد الصفوف المطابقة وعدد ما لم يجد مطابقًا. أو ضع ملفين في ملف واحد، متوائمين بأسماء الأعمدة لا بمواقعها، لأن الدمج بالمواقع هو ما ينقل رقم الهاتف إلى عمود المدينة بصمت. لا يُرفع شيء.',
  },
}
