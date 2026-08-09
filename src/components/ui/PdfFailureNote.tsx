import { Link } from 'react-router-dom'
import { FileError } from './FileError'
import type { PdfFailure } from '../../lib/pdfFailure'
import type { Locale } from '../../i18n'

// One wording for "this PDF could not be opened", shared by the seven tools
// built on pdf-lib. Extracted for the same reason as `PdfPassword.tsx`: the
// wording IS the substance here, and seven tools drifting into seven answers
// about what went wrong and what to do next would be worse than the
// duplication. They had already drifted into two wrong answers — three tools
// calling every failure a password and three calling every failure corruption.

const STR = {
  en: {
    encrypted: 'This PDF is password-protected, so it cannot be opened here — the library that writes the new file cannot decrypt one. Its text can still be read, with the password you already have.',
    unreadable: 'That file could not be read as a PDF. It may be damaged, or it may not be a PDF at all.',
    toText: 'Open it in PDF to Text',
  },
  ar: {
    encrypted: 'هذا الملف محمي بكلمة مرور فلا يمكن فتحه هنا — إذ لا تستطيع المكتبة التي تكتب الملف الجديد فك التشفير. ويبقى بإمكانك قراءة نصّه بكلمة المرور التي لديك.',
    unreadable: 'تعذّرت قراءة هذا الملف كـPDF. قد يكون تالفًا، أو قد لا يكون ملف PDF أصلًا.',
    toText: 'افتحه في أداة PDF إلى نص',
  },
}

export function PdfFailureNote({ why, locale }: { why: PdfFailure; locale: Locale }) {
  const s = STR[locale]
  return (
    <div className="flex flex-col gap-2 items-start" data-testid="pdf-failure" data-why={why}>
      <FileError message={why === 'encrypted' ? s.encrypted : s.unreadable} />
      {/* A refusal with nowhere to go is a dead end for a file the reader can
          perfectly well open in the tool next door. */}
      {why === 'encrypted' && (
        <Link
          to={`/${locale}/apps/pdf-to-text`}
          data-testid="pdf-failure-to-text"
          className="inline-flex items-center gap-2 px-[1.15rem] py-[0.6rem] rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink font-semibold text-[0.9rem] no-underline hover:border-[color-mix(in_srgb,var(--green-500)_40%,transparent)] rtl:font-ar"
        >
          {s.toText}
        </Link>
      )}
    </div>
  )
}
