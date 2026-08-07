import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Textarea, Field, Stack, Panel, StatusBadge } from '../../components/ui'
import { UploadIcon } from '../../components/icons'
import { pemToDer } from './asn1'
import { daysUntil, nameToString, parseCertificate, type Certificate } from './x509'

const STR = {
  en: {
    paste: 'Paste a certificate (PEM), or choose a file',
    choose: 'Choose a .pem or .crt',
    placeholder: '-----BEGIN CERTIFICATE-----\nMIID…\n-----END CERTIFICATE-----',
    subject: 'Issued to', issuer: 'Issued by',
    valid: 'Valid', from: 'From', until: 'Until',
    expired: (n: number) => `Expired ${n} day${n === 1 ? '' : 's'} ago`,
    expiresIn: (n: number) => `Expires in ${n} day${n === 1 ? '' : 's'}`,
    notYet: 'Not valid yet',
    selfSigned: 'Self-signed',
    key: 'Public key', sig: 'Signature', serial: 'Serial', version: 'Version',
    fingerprint: 'SHA-256 fingerprint',
    names: 'Covers these names',
    extensions: 'Extensions', critical: 'critical',
    error: 'That does not look like a certificate. Paste the PEM block including the BEGIN and END lines, or choose a .pem, .crt or .cer file. A private key or a certificate request is a different thing and will not decode here.',
    localNote: 'The certificate is decoded on this page — it is never uploaded. Certificates are public by design, but the habit is the point: nothing here needs a server, so nothing here gets one.',
    verifyNote: 'This reads what the certificate says. It does not check the signature against an issuer or a revocation list, so a certificate can look perfect here and still be untrusted by a browser.',
  },
  ar: {
    paste: 'الصق شهادة (PEM)، أو اختر ملفًا',
    choose: 'اختر ملف ‎.pem‎ أو ‎.crt‎',
    placeholder: '-----BEGIN CERTIFICATE-----\nMIID…\n-----END CERTIFICATE-----',
    subject: 'صادرة إلى', issuer: 'صادرة من',
    valid: 'الصلاحية', from: 'من', until: 'إلى',
    expired: (n: number) => `انتهت قبل ${n} يومًا`,
    expiresIn: (n: number) => `تنتهي خلال ${n} يومًا`,
    notYet: 'لم تبدأ صلاحيتها بعد',
    selfSigned: 'موقّعة ذاتيًا',
    key: 'المفتاح العام', sig: 'التوقيع', serial: 'الرقم التسلسلي', version: 'الإصدار',
    fingerprint: 'بصمة SHA-256',
    names: 'تغطي هذه الأسماء',
    extensions: 'الامتدادات', critical: 'حرجة',
    error: 'لا يبدو هذا شهادة. الصق كتلة PEM بسطري BEGIN وEND، أو اختر ملف ‎.pem‎ أو ‎.crt‎ أو ‎.cer‎. أما المفتاح الخاص أو طلب الشهادة فشيء آخر لا يُفك هنا.',
    localNote: 'تُفكّ الشهادة في هذه الصفحة — ولا تُرفع أبدًا. والشهادات علنية بطبيعتها، لكن العادة هي المقصد: فما لا يحتاج خادمًا هنا لا يُعطى خادمًا.',
    verifyNote: 'تقرأ الأداة ما تقوله الشهادة. ولا تتحقق من التوقيع مقابل جهة إصدار ولا من قوائم الإلغاء، فقد تبدو الشهادة سليمة هنا ويرفضها المتصفح.',
  },
}

export default function CertDecoderTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('')
  const [cert, setCert] = useState<Certificate | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let live = true
    if (!text.trim()) { setCert(null); setError(false); return }
    const der = pemToDer(text)
    if (!der) { setCert(null); setError(true); return }
    parseCertificate(der)
      .then((c) => { if (live) { setCert(c); setError(false) } })
      .catch(() => { if (live) { setCert(null); setError(true) } })
    return () => { live = false }
  }, [text])

  const days = useMemo(() => daysUntil(cert?.notAfter ?? null), [cert])
  const fmt = (d: Date | null) => (d ? d.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

  const started = cert?.notBefore ? cert.notBefore.getTime() <= Date.now() : true
  const status = days == null ? '' : days < 0 ? s.expired(Math.abs(days)) : !started ? s.notYet : s.expiresIn(days)
  const bad = days != null && (days < 0 || !started)

  return (
    <Stack data-testid="cert-decoder">
      <Field label={s.paste}>
        <Textarea rows={7} value={text} placeholder={s.placeholder} data-testid="cd-input"
          className="font-mono text-[0.8rem]" dir="ltr" onChange={(e) => setText(e.target.value)} />
      </Field>
      <label className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-[0.9rem] cursor-pointer">
        <UploadIcon /> {s.choose}
        <input type="file" className="hidden" data-testid="cd-file"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()) }} />
      </label>

      {error && <p className="text-[0.95rem] text-gold-500 rtl:font-ar" data-testid="cd-error">{s.error}</p>}

      {cert && (
        <>
          <Panel className="gap-3" data-testid="cd-summary">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`text-[1.05rem] font-semibold ${bad ? 'text-gold-500' : 'text-green-700'}`} data-testid="cd-status">{status}</span>
              {cert.selfSigned && <StatusBadge status="beta">{s.selfSigned}</StatusBadge>}
            </div>
            <div className="grid gap-3 grid-cols-1 min-[620px]:grid-cols-2">
              <div>
                <span className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.subject}</span>
                <p className="text-ink font-mono text-[0.88rem] break-words" data-testid="cd-subject">{nameToString(cert.subject) || '—'}</p>
              </div>
              <div>
                <span className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.issuer}</span>
                <p className="text-ink font-mono text-[0.88rem] break-words" data-testid="cd-issuer">{nameToString(cert.issuer) || '—'}</p>
              </div>
            </div>
            <div className="grid gap-3 grid-cols-2 min-[620px]:grid-cols-4 text-[0.85rem]">
              <div><span className="text-ink-faint block text-[0.7rem] uppercase">{s.from}</span><span className="text-ink" data-testid="cd-from">{fmt(cert.notBefore)}</span></div>
              <div><span className="text-ink-faint block text-[0.7rem] uppercase">{s.until}</span><span className="text-ink" data-testid="cd-until">{fmt(cert.notAfter)}</span></div>
              <div><span className="text-ink-faint block text-[0.7rem] uppercase">{s.key}</span><span className="text-ink font-mono" data-testid="cd-key">{cert.publicKeyAlgorithm}{cert.publicKeyBits ? ` ${cert.publicKeyBits}` : ''}</span></div>
              <div><span className="text-ink-faint block text-[0.7rem] uppercase">{s.sig}</span><span className="text-ink font-mono" data-testid="cd-sig">{cert.signatureAlgorithm}</span></div>
            </div>
          </Panel>

          {cert.san.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.names}</h2>
              <div className="flex flex-wrap gap-2" data-testid="cd-san">
                {cert.san.map((n) => (
                  <span key={n} className="font-mono text-[0.82rem] px-2 py-1 rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-ink">{n}</span>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.extensions}</h2>
            <div className="overflow-x-auto border border-[color:var(--line)] rounded-md bg-[var(--surface)]">
              <table className="w-full text-[0.82rem] border-collapse" data-testid="cd-extensions">
                <tbody>
                  {cert.extensions.map((e) => (
                    <tr key={e.oid} className="border-t border-[color:var(--line-soft)] first:border-t-0">
                      <td className="px-3 py-1.5 text-ink whitespace-nowrap">
                        {e.name}
                        {e.critical && <span className="text-gold-500 text-[0.7rem]"> · {s.critical}</span>}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-ink-soft break-all">{e.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-col gap-1 text-[0.82rem]">
            <span className="text-ink-faint uppercase text-[0.7rem] tracking-[0.05em]">{s.fingerprint}</span>
            <code className="font-mono text-ink break-all" data-testid="cd-fingerprint">{cert.fingerprint}</code>
            <span className="text-ink-faint font-mono" data-testid="cd-serial">{s.serial}: {cert.serial} · {s.version} {cert.version}</span>
          </div>
        </>
      )}

      <Panel className="gap-1">
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.localNote}</p>
        <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.verifyNote}</p>
      </Panel>
    </Stack>
  )
}
