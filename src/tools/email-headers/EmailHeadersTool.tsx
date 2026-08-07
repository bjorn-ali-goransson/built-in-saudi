import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Textarea, Field, Stack, Panel, Seg, SegButton } from '../../components/ui'
import { analyse, humanDelay, type Verdict } from './headers'

const STR = {
  en: {
    paste: 'Paste the full headers',
    how: 'In Gmail: open the message → ⋯ → Show original. In Outlook: File → Properties. In Apple Mail: View → Message → All Headers.',
    placeholder: 'Received: from mail.example.com (…)\nFrom: someone@example.com\nSubject: …',
    tabs: { journey: 'Journey', auth: 'Authentication', all: 'All headers' },
    from: 'From', to: 'To', subject: 'Subject', date: 'Sent', messageId: 'Message ID',
    replyTo: 'Reply-To', returnPath: 'Return-Path',
    hops: 'Hops', totalTime: 'Total time in transit',
    hop: 'Hop', hopFrom: 'From', hopBy: 'Received by', delay: 'Delay',
    verdicts: { pass: 'pass', fail: 'fail', softfail: 'soft fail', neutral: 'neutral', none: 'none', unknown: 'not stated' } as Record<Verdict, string>,
    spf: 'SPF', dkim: 'DKIM', dmarc: 'DMARC',
    spfWhat: 'Was this server allowed to send for that domain?',
    dkimWhat: 'Was the message signed, and does the signature still match?',
    dmarcWhat: 'Does the domain owner say to trust the result?',
    flags: 'Worth a second look',
    flagNames: {
      'auth-fail': (d: string) => `${d} failed. That does not prove a forgery on its own — forwarding and mailing lists break these routinely — but a bank that fails DMARC is not your bank.`,
      'reply-to': (d: string) => `A reply goes to a different domain than the sender: ${d}. Legitimate for a helpdesk, and the oldest trick in the book otherwise.`,
      'return-path': (d: string) => `Bounces go to a different domain than the sender: ${d}. Normal for a mailing service, worth noticing anywhere else.`,
      'no-received': () => 'No Received headers at all — you may have pasted only part of the message.',
    } as Record<string, (d: string) => string>,
    noneYet: 'Paste some headers above.',
    notHeaders: 'No headers could be read from that. Paste the whole block, starting with lines like "Received:" or "From:".',
    privacy: 'Parsed on this page and never uploaded. That is not a small thing here: the headers of a message you were told to be suspicious of usually carry your own address, your employer’s internal hostnames and the message id — and every online header analyser asks you to paste exactly that into their server.',
    order: 'Hops are listed in the order the message actually travelled. The raw headers are the other way round — each server adds its own line at the top — which is why a message can look like it went backwards.',
  },
  ar: {
    paste: 'الصق الترويسات كاملة',
    how: 'في Gmail: افتح الرسالة ← ⋯ ← إظهار الأصل. في Outlook: ملف ← خصائص. في Apple Mail: عرض ← رسالة ← كل الترويسات.',
    placeholder: 'Received: from mail.example.com (…)\nFrom: someone@example.com\nSubject: …',
    tabs: { journey: 'الرحلة', auth: 'التوثيق', all: 'كل الترويسات' },
    from: 'من', to: 'إلى', subject: 'الموضوع', date: 'أُرسلت', messageId: 'معرّف الرسالة',
    replyTo: 'الرد إلى', returnPath: 'مسار الإرجاع',
    hops: 'المحطات', totalTime: 'إجمالي زمن العبور',
    hop: 'المحطة', hopFrom: 'من', hopBy: 'استلمها', delay: 'التأخير',
    verdicts: { pass: 'نجح', fail: 'فشل', softfail: 'فشل جزئي', neutral: 'محايد', none: 'لا شيء', unknown: 'غير مذكور' } as Record<Verdict, string>,
    spf: 'SPF', dkim: 'DKIM', dmarc: 'DMARC',
    spfWhat: 'هل كان مسموحًا لهذا الخادم أن يرسل باسم ذلك النطاق؟',
    dkimWhat: 'هل وُقّعت الرسالة، وهل ما زال التوقيع مطابقًا؟',
    dmarcWhat: 'هل يقول مالك النطاق إن النتيجة جديرة بالثقة؟',
    flags: 'يستحق نظرة ثانية',
    flagNames: {
      'auth-fail': (d: string) => `فشل ${d}. وهذا وحده لا يثبت تزويرًا — فإعادة التوجيه والقوائم البريدية تكسر هذه الفحوص كثيرًا — لكن بنكًا يفشل في DMARC ليس بنكك.`,
      'reply-to': (d: string) => `يذهب الرد إلى نطاق غير نطاق المرسل: ${d}. وهذا مشروع في مكتب دعم، وأقدم حيلة في الكتاب فيما عداه.`,
      'return-path': (d: string) => `ترتد الرسائل إلى نطاق غير نطاق المرسل: ${d}. معتاد في خدمات الإرسال، وجدير بالانتباه في غيرها.`,
      'no-received': () => 'لا توجد ترويسات Received البتة — لعلك لصقت جزءًا من الرسالة فقط.',
    } as Record<string, (d: string) => string>,
    noneYet: 'الصق ترويسات في الأعلى.',
    notHeaders: 'تعذّرت قراءة أي ترويسات من ذلك. الصق الكتلة كاملة، بدءًا بأسطر مثل ‎"Received:"‎ أو ‎"From:"‎.',
    privacy: 'تُحلَّل في هذه الصفحة ولا تُرفع أبدًا. وليس هذا بالأمر الهيّن هنا: فترويسات رسالة قيل لك أن تشك فيها تحمل عادةً عنوانك أنت، وأسماء خوادم جهة عملك الداخلية، ومعرّف الرسالة — وكل محلّل ترويسات على الإنترنت يطلب منك لصق ذلك بعينه في خادمه.',
    order: 'تُعرض المحطات بالترتيب الذي سلكته الرسالة فعلًا. أما الترويسات الخام فبالعكس — إذ يضيف كل خادم سطره في الأعلى — ولهذا تبدو الرسالة كأنها سارت إلى الوراء.',
  },
}

const TONE: Record<Verdict, string> = {
  pass: 'text-green-700',
  fail: 'text-gold-500',
  softfail: 'text-gold-500',
  neutral: 'text-ink-soft',
  none: 'text-ink-soft',
  unknown: 'text-ink-faint',
}

export default function EmailHeadersTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [raw, setRaw] = useState('')
  const [tab, setTab] = useState<'journey' | 'auth' | 'all'>('journey')

  const a = useMemo(() => (raw.trim() ? analyse(raw) : null), [raw])
  const fmt = (d: Date | null) => (d ? d.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-GB', { dateStyle: 'medium', timeStyle: 'medium' }) : '—')

  return (
    <Stack data-testid="email-headers">
      <Field label={s.paste}>
        <Textarea rows={8} value={raw} placeholder={s.placeholder} data-testid="eh-input"
          className="font-mono text-[0.8rem]" dir="ltr" onChange={(e) => setRaw(e.target.value)} />
      </Field>
      <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.how}</p>

      {a && !a.headers.length && <p className="text-[0.95rem] text-gold-500 rtl:font-ar" data-testid="eh-not-headers">{s.notHeaders}</p>}

      {a && a.headers.length > 0 && (
        <>
          <Panel className="gap-2" data-testid="eh-summary">
            <div className="grid gap-2 grid-cols-1 min-[620px]:grid-cols-2 text-[0.88rem]">
              <div><span className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint block">{s.from}</span><span className="text-ink break-words" data-testid="eh-from">{a.from || '—'}</span></div>
              <div><span className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint block">{s.to}</span><span className="text-ink break-words" data-testid="eh-to">{a.to || '—'}</span></div>
              <div className="min-[620px]:col-span-2"><span className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint block">{s.subject}</span><span className="text-ink break-words" data-testid="eh-subject">{a.subject || '—'}</span></div>
              <div><span className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint block">{s.date}</span><span className="text-ink" data-testid="eh-date">{fmt(a.date)}</span></div>
              <div><span className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint block">{s.totalTime}</span><span className="text-ink font-mono" data-testid="eh-total">{humanDelay(a.totalSeconds)}</span></div>
            </div>
          </Panel>

          {a.flags.length > 0 && (
            <section className="flex flex-col gap-2" data-testid="eh-flags">
              <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.flags}</h2>
              {a.flags.map((f) => (
                <p key={f.key} data-testid={`eh-flag-${f.key}`}
                  className="text-[0.88rem] text-ink leading-snug border-s-[3px] border-gold-500 bg-[color-mix(in_srgb,var(--color-gold-400)_12%,transparent)] ps-3 pe-3 py-2 rounded-e-md rtl:font-ar">
                  {s.flagNames[f.key]?.(f.detail) ?? f.key}
                </p>
              ))}
            </section>
          )}

          <Seg data-testid="eh-tabs">
            {(['journey', 'auth', 'all'] as const).map((t) => (
              <SegButton key={t} active={tab === t} onClick={() => setTab(t)} data-testid={`eh-tab-${t}`}>{s.tabs[t]}</SegButton>
            ))}
          </Seg>

          {tab === 'journey' && (
            <section className="flex flex-col gap-2">
              <div className="overflow-x-auto border border-[color:var(--line)] rounded-md bg-[var(--surface)]">
                <table className="w-full text-[0.82rem] border-collapse" data-testid="eh-hops">
                  <thead>
                    <tr className="text-ink-faint text-[0.7rem] uppercase tracking-[0.05em]">
                      <th className="text-start px-3 py-2 font-body">{s.hop}</th>
                      <th className="text-start px-3 py-2 font-body">{s.hopFrom}</th>
                      <th className="text-start px-3 py-2 font-body">{s.hopBy}</th>
                      <th className="text-start px-3 py-2 font-body">{s.delay}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.hops.map((h) => (
                      <tr key={h.index} className="border-t border-[color:var(--line-soft)]" data-testid={`eh-hop-${h.index}`}>
                        <td className="px-3 py-1.5 font-mono text-ink-faint">{h.index}</td>
                        <td className="px-3 py-1.5 font-mono text-ink break-all">{h.from || '—'}</td>
                        <td className="px-3 py-1.5 font-mono text-ink-soft break-all">{h.by || '—'}</td>
                        <td className="px-3 py-1.5 font-mono whitespace-nowrap">{humanDelay(h.delay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.order}</p>
            </section>
          )}

          {tab === 'auth' && (
            <section className="flex flex-col gap-2" data-testid="eh-auth">
              {([['spf', s.spfWhat], ['dkim', s.dkimWhat], ['dmarc', s.dmarcWhat]] as const).map(([k, what]) => (
                <div key={k} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-[color:var(--line-soft)] pt-2 first:border-t-0">
                  <span className="font-mono text-[0.9rem] text-ink w-16">{s[k]}</span>
                  <span className={`font-semibold text-[0.95rem] ${TONE[a.auth[k]]}`} data-testid={`eh-${k}`}>{s.verdicts[a.auth[k]]}</span>
                  <span className="text-[0.82rem] text-ink-faint rtl:font-ar flex-1 min-w-[14rem]">{what}</span>
                </div>
              ))}
              {a.auth.raw && (
                <pre className="overflow-x-auto text-[0.78rem] font-mono text-ink-soft bg-[var(--surface)] border border-[color:var(--line)] rounded-md p-2 mt-1" data-testid="eh-auth-raw">{a.auth.raw}</pre>
              )}
            </section>
          )}

          {tab === 'all' && (
            <div className="overflow-x-auto border border-[color:var(--line)] rounded-md bg-[var(--surface)]">
              <table className="w-full text-[0.8rem] border-collapse" data-testid="eh-all">
                <tbody>
                  {a.headers.map((h, i) => (
                    <tr key={i} className="border-t border-[color:var(--line-soft)] first:border-t-0">
                      <td className="px-3 py-1 font-mono text-ink-faint align-top whitespace-nowrap">{h.name}</td>
                      <td className="px-3 py-1 font-mono text-ink break-all">{h.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.privacy}</p></Panel>
    </Stack>
  )
}
