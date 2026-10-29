// The spreadsheet tool: a library of workbooks kept in this browser, and the
// editor for the one that is open.
import { useMemo } from 'react'
import { useLocale } from '../../i18n'
import { OfficeApp } from '../../components/office/OfficeApp'
import { excelKit } from './kit'
import { excelTemplates } from './templates'
import { XL_STR } from './strings'
import ExcelEditor from './ExcelEditor'

export default function ExcelEditorTool() {
  const { locale } = useLocale()
  const loc = locale === 'ar' ? 'ar' : 'en'
  const kit = useMemo(() => excelKit(loc), [loc])
  const templates = useMemo(() => excelTemplates(loc), [loc])
  return <OfficeApp kit={kit} Editor={ExcelEditor} templates={templates} blurb={<p className="text-ink-soft text-[0.95rem] max-w-[62ch]">{XL_STR[loc].blurb}</p>} />
}
